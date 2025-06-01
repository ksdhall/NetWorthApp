// src/components/identity/IdentityDocumentForm.tsx
'use client';

import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"; // Assuming Dialog is used for the form
import { IdentityDocumentType, IdentityDocument } from '@prisma/client';
import { z } from 'zod';

// Zod schema for client-side validation (can be imported if shared with backend)
const identityDocumentFormSchema = z.object({
  docType: z.nativeEnum(IdentityDocumentType, { required_error: "Document type is required." }),
  docNumber: z.string().min(1, "Document number is required."),
  issueDate: z.preprocess((arg) => {
    if (typeof arg === "string" && arg) return new Date(arg);
    if (arg instanceof Date) return arg;
    return null; // Allow null for optional or if cleared
  }, z.date().nullable().optional()),
  expiryDate: z.preprocess((arg) => {
    if (typeof arg === "string" && arg) return new Date(arg);
    if (arg instanceof Date) return arg;
    return null;
  }, z.date().nullable().optional()),
  issuingAuthority: z.string().optional().nullable(),
  isPrimary: z.boolean().optional().default(false),
  scanPath: z.string().optional().nullable(), // Placeholder for file name or info
});

type IdentityDocumentFormData = z.infer<typeof identityDocumentFormSchema>;

interface IdentityDocumentFormProps {
  documentToEdit?: IdentityDocument | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void; // To refresh the list
}

export default function IdentityDocumentForm({
  documentToEdit,
  isOpen,
  onClose,
  onSave,
}: IdentityDocumentFormProps) {
  const [formData, setFormData] = useState<Partial<IdentityDocumentFormData>>({});
  const [errors, setErrors] = useState<z.ZodError<IdentityDocumentFormData> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) { // Only reset form data when dialog opens
      if (documentToEdit) {
        setFormData({
          ...documentToEdit,
          // Ensure date objects are used for date inputs if values exist
          issueDate: documentToEdit.issueDate ? new Date(documentToEdit.issueDate) : null,
          expiryDate: documentToEdit.expiryDate ? new Date(documentToEdit.expiryDate) : null,
        });
      } else {
        // Default values for new form
        setFormData({
          docType: undefined, // Explicitly undefined to show placeholder
          docNumber: '',
          issueDate: null,
          expiryDate: null,
          issuingAuthority: '',
          isPrimary: false,
          scanPath: ''
        });
      }
      setErrors(null); // Clear errors when document changes or form opens/closes
      setServerError(null);
    }
  }, [documentToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
        setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value as IdentityDocumentType })); // Cast for docType
  };

  // This function is not directly used by <Input type="date"> if its value is managed as string.
  // However, if using a date picker component that returns a Date object, this would be useful.
  // For <Input type="date">, ensure the value is in 'YYYY-MM-DD' format.
  // const handleDateChange = (name: string, date: Date | null) => {
  //   setFormData(prev => ({ ...prev, [name]: date }));
  // };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors(null);
    setServerError(null);

    // Prepare data for Zod parsing, ensuring empty strings for dates become null
    const dataToParse = {
        ...formData,
        issueDate: formData.issueDate || null,
        expiryDate: formData.expiryDate || null,
        issuingAuthority: formData.issuingAuthority || null,
        scanPath: formData.scanPath || null,
    };


    const result = identityDocumentFormSchema.safeParse(dataToParse);
    if (!result.success) {
      setErrors(result.error);
      return;
    }

    setIsSubmitting(true);
    const method = documentToEdit ? 'PUT' : 'POST';
    const url = documentToEdit
      ? `/api/identity-documents/${documentToEdit.id}`
      : '/api/identity-documents';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.data), // Send validated and transformed data
      });

      if (!response.ok) {
        const errorData = await response.json();
        // errorData.error could be an array of Zod issues from backend or a string message
        const message = Array.isArray(errorData.error)
          ? errorData.error.map((e: { path?: (string|number)[]; message: string; }) => e.path ? `${e.path.join('.')}: ${e.message}` : e.message).join('; ')
          : (errorData.error?.message || errorData.error || 'Failed to save document');
        throw new Error(message);
      }

      onSave();
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setServerError(err.message);
      } else {
        setServerError("An unexpected error occurred.");
      }
      console.error("Save error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getError = (field: keyof IdentityDocumentFormData) => {
    return errors?.errors.find(e => e.path.includes(field))?.message;
  }

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-[525px] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
        <DialogHeader>
          <DialogTitle>
            {documentToEdit ? 'Edit Identity Document' : 'Add New Identity Document'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {serverError && <p className="text-sm text-red-500 bg-red-100 dark:bg-red-900 dark:text-red-200 p-3 rounded-md">{serverError}</p>}

          <div>
            <Label htmlFor="docType">Document Type</Label>
            <Select
              name="docType"
              value={formData.docType || ''}
              onValueChange={(value) => handleSelectChange('docType', value)}
              disabled={isSubmitting}
            >
              <SelectTrigger id="docType" className="w-full dark:bg-gray-700 dark:border-gray-600">
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent className="dark:bg-gray-900 border-gray-700">
                {Object.values(IdentityDocumentType).map((type) => (
                  <SelectItem key={type} value={type} className="dark:focus:bg-gray-700">
                    {type.replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {getError('docType') && <p className="text-sm text-red-500 mt-1">{getError('docType')}</p>}
          </div>

          <div>
            <Label htmlFor="docNumber">Document Number</Label>
            <Input
              id="docNumber"
              name="docNumber"
              value={formData.docNumber || ''}
              onChange={handleChange}
              disabled={isSubmitting}
              className="dark:bg-gray-700 dark:border-gray-600"
            />
            {getError('docNumber') && <p className="text-sm text-red-500 mt-1">{getError('docNumber')}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="issueDate">Issue Date</Label>
              <Input
                id="issueDate"
                name="issueDate"
                type="date"
                value={formData.issueDate ? (formData.issueDate instanceof Date ? formData.issueDate.toISOString().split('T')[0] : String(formData.issueDate)) : ''}
                onChange={handleChange}
                disabled={isSubmitting}
                className="dark:bg-gray-700 dark:border-gray-600"
              />
              {getError('issueDate') && <p className="text-sm text-red-500 mt-1">{getError('issueDate')}</p>}
            </div>
            <div>
              <Label htmlFor="expiryDate">Expiry Date</Label>
              <Input
                id="expiryDate"
                name="expiryDate"
                type="date"
                value={formData.expiryDate ? (formData.expiryDate instanceof Date ? formData.expiryDate.toISOString().split('T')[0] : String(formData.expiryDate)) : ''}
                onChange={handleChange}
                disabled={isSubmitting}
                className="dark:bg-gray-700 dark:border-gray-600"
              />
              {getError('expiryDate') && <p className="text-sm text-red-500 mt-1">{getError('expiryDate')}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="issuingAuthority">Issuing Authority</Label>
            <Input
              id="issuingAuthority"
              name="issuingAuthority"
              value={formData.issuingAuthority || ''}
              onChange={handleChange}
              disabled={isSubmitting}
              className="dark:bg-gray-700 dark:border-gray-600"
            />
             {getError('issuingAuthority') && <p className="text-sm text-red-500 mt-1">{getError('issuingAuthority')}</p>}
          </div>

          <div>
            <Label htmlFor="scanPath">Scan Info/Filename (No upload)</Label>
            <Input
              id="scanPath"
              name="scanPath"
              value={formData.scanPath || ''}
              onChange={handleChange}
              placeholder="e.g., passport_scan.pdf"
              disabled={isSubmitting}
              className="dark:bg-gray-700 dark:border-gray-600"
            />
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="isPrimary"
              name="isPrimary"
              checked={formData.isPrimary || false}
              onCheckedChange={(checkedState) => {
                // checkedState can be boolean or 'indeterminate'
                const isChecked = checkedState === true;
                setFormData((prev) => ({ ...prev, isPrimary: isChecked }));
              }}
              disabled={isSubmitting}
              className="dark:border-gray-500 data-[state=checked]:dark:bg-blue-500"
            />
            <Label htmlFor="isPrimary" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Set as primary document
            </Label>
          </div>

          <DialogFooter className="pt-6">
            <DialogClose asChild>
              <Button type="button" variant="outline" onClick={onClose} className="dark:border-gray-600 hover:dark:bg-gray-700">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">
              {isSubmitting ? (documentToEdit ? 'Saving...' : 'Adding...') : (documentToEdit ? 'Save Changes' : 'Add Document')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
