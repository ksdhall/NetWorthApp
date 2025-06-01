// src/components/pension-funds/PensionForm.tsx
'use client';

import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
} from "@/components/ui/dialog";
import { PensionProfile, AssetCategory, PensionCountry, AssetType } from '@prisma/client'; // Added AssetType
import { z } from 'zod';

// Zod schema for client-side validation
const pensionFormSchema = z.object({
  country: z.nativeEnum(PensionCountry, { required_error: "Country is required." }),
  employerName: z.string().optional().nullable().transform(val => val === "" ? null : val),
  accountNumber: z.string().optional().nullable().transform(val => val === "" ? null : val),
  contributionToDate: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? null : (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number().positive("Contribution must be positive if provided.").nullable().optional()
  ),
  employeeSharePercent: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? null : (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number().min(0, "Cannot be negative.").max(100, "Cannot exceed 100.").nullable().optional()
  ),
  employerSharePercent: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? null : (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number().min(0,"Percentage cannot be negative.").max(100, "Percentage cannot exceed 100.").nullable().optional()
  ),
  projectedPayout: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? null : (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number().positive("Projected payout must be positive if provided.").nullable().optional()
  ),
  assetCategoryId: z.string().optional().nullable().transform(val => val === "" || val === "none" ? null : val),
  notes: z.string().optional().nullable().transform(val => val === "" ? null : val),
});

type PensionFormData = z.infer<typeof pensionFormSchema>;

interface PensionFormProps {
  profileToEdit?: PensionProfile | null;
  assetCategories: Pick<AssetCategory, 'id' | 'name' | 'type'>[];
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function PensionForm({
  profileToEdit,
  assetCategories,
  isOpen,
  onClose,
  onSave,
}: PensionFormProps) {
  const [formData, setFormData] = useState<Partial<PensionFormData>>({});
  const [errors, setErrors] = useState<z.ZodError<PensionFormData> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (profileToEdit) {
        setFormData({
          ...profileToEdit,
          contributionToDate: profileToEdit.contributionToDate ? Number(profileToEdit.contributionToDate) : null,
          employeeSharePercent: profileToEdit.employeeSharePercent ? Number(profileToEdit.employeeSharePercent) : null,
          employerSharePercent: profileToEdit.employerSharePercent ? Number(profileToEdit.employerSharePercent) : null,
          projectedPayout: profileToEdit.projectedPayout ? Number(profileToEdit.projectedPayout) : null,
          assetCategoryId: profileToEdit.assetCategoryId || undefined,
        });
      } else {
        setFormData({
            country: PensionCountry.INDIA, // Default for new profile
            employerName: '', accountNumber: '', contributionToDate: null, employeeSharePercent: null,
            employerSharePercent: null, projectedPayout: null, assetCategoryId: undefined, notes: ''
        });
      }
      setErrors(null);
      setServerError(null);
    }
  }, [profileToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'number') {
        setFormData((prev) => ({ ...prev, [name]: value === '' ? null : parseFloat(value) }));
    } else {
        setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSelectChange = (name: keyof PensionFormData, value: string) => {
    const valToSet = (value === "none" || value === "") ? null : value;
    setFormData((prev) => ({ ...prev, [name]: valToSet as any }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors(null);
    setServerError(null);

    const dataToParse = {
        ...formData,
        contributionToDate: formData.contributionToDate ? Number(formData.contributionToDate) : null,
        employeeSharePercent: formData.employeeSharePercent ? Number(formData.employeeSharePercent) : null,
        employerSharePercent: formData.employerSharePercent ? Number(formData.employerSharePercent) : null,
        projectedPayout: formData.projectedPayout ? Number(formData.projectedPayout) : null,
    };

    const result = pensionFormSchema.safeParse(dataToParse);
    if (!result.success) {
      setErrors(result.error);
      return;
    }

    setIsSubmitting(true);
    const method = profileToEdit ? 'PUT' : 'POST';
    const url = profileToEdit ? `/api/pension-profiles/${profileToEdit.id}` : '/api/pension-profiles';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.data),
      });
      const responseData = await response.json();
      if (!response.ok) {
        const message = Array.isArray(responseData.error)
          ? responseData.error.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ')
          : (responseData.error?.message || responseData.error || 'Failed to save pension profile');
        throw new Error(message);
      }
      onSave();
      onClose();
    } catch (err: any) {
      setServerError(err.message || "An unexpected error occurred.");
      console.error("Save error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getError = (field: keyof PensionFormData) => errors?.errors.find(e => e.path.includes(field))?.message;

  if (!isOpen) return null;

  const relevantAssetCategories = assetCategories.filter(cat => cat.type === AssetType.ASSET);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
        <DialogHeader><DialogTitle>{profileToEdit ? 'Edit Pension Profile' : 'Add New Pension Profile'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-4 max-h-[75vh] overflow-y-auto pr-2 sm:pr-4">
          {serverError && <p className="text-sm text-red-500 bg-red-100 dark:bg-red-900/30 dark:text-red-200 p-3 rounded-md">{serverError}</p>}

          <div>
            <Label htmlFor="country">Country</Label>
            <Select name="country" value={formData.country || ''} onValueChange={(value) => handleSelectChange('country', value as PensionCountry)} disabled={isSubmitting}>
              <SelectTrigger id="country" className="dark:bg-gray-700 dark:border-gray-600"><SelectValue placeholder="Select country..." /></SelectTrigger>
              <SelectContent className="dark:bg-gray-900 border-gray-700">{Object.values(PensionCountry).map(c => <SelectItem key={c} value={c} className="dark:focus:bg-gray-700">{c.charAt(0) + c.slice(1).toLowerCase().replace('_',' ')}</SelectItem>)}</SelectContent>
            </Select>
            {getError('country') && <p className="text-xs text-red-500 mt-1">{getError('country')}</p>}
          </div>

          <div><Label htmlFor="employerName">Employer Name (Optional)</Label><Input id="employerName" name="employerName" value={formData.employerName || ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('employerName') && <p className="text-xs text-red-500 mt-1">{getError('employerName')}</p>}</div>
          <div><Label htmlFor="accountNumber">Account Number (Optional)</Label><Input id="accountNumber" name="accountNumber" value={formData.accountNumber || ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('accountNumber') && <p className="text-xs text-red-500 mt-1">{getError('accountNumber')}</p>}</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label htmlFor="contributionToDate">Contribution to Date (Optional)</Label><Input id="contributionToDate" name="contributionToDate" type="number" step="any" value={formData.contributionToDate ?? ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('contributionToDate') && <p className="text-xs text-red-500 mt-1">{getError('contributionToDate')}</p>}</div>
            <div><Label htmlFor="projectedPayout">Projected Payout (Optional)</Label><Input id="projectedPayout" name="projectedPayout" type="number" step="any" value={formData.projectedPayout ?? ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('projectedPayout') && <p className="text-xs text-red-500 mt-1">{getError('projectedPayout')}</p>}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label htmlFor="employeeSharePercent">Employee Share % (Optional)</Label><Input id="employeeSharePercent" name="employeeSharePercent" type="number" step="0.01" min="0" max="100" value={formData.employeeSharePercent ?? ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('employeeSharePercent') && <p className="text-xs text-red-500 mt-1">{getError('employeeSharePercent')}</p>}</div>
            <div><Label htmlFor="employerSharePercent">Employer Share % (Optional)</Label><Input id="employerSharePercent" name="employerSharePercent" type="number" step="0.01" min="0" max="100" value={formData.employerSharePercent ?? ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('employerSharePercent') && <p className="text-xs text-red-500 mt-1">{getError('employerSharePercent')}</p>}</div>
          </div>

          <div>
            <Label htmlFor="assetCategoryId">Category (Optional)</Label>
            <Select name="assetCategoryId" value={formData.assetCategoryId || 'none'} onValueChange={(value) => handleSelectChange('assetCategoryId', value)} disabled={isSubmitting}>
                <SelectTrigger id="assetCategoryId" className="dark:bg-gray-700 dark:border-gray-600"><SelectValue placeholder="Select category..." /></SelectTrigger>
                <SelectContent className="dark:bg-gray-900 border-gray-700">
                    <SelectItem value="none" className="dark:focus:bg-gray-700">None</SelectItem>
                    {relevantAssetCategories.map(cat => <SelectItem key={cat.id} value={cat.id} className="dark:focus:bg-gray-700">{cat.name}</SelectItem>)}
                </SelectContent>
            </Select>
            {getError('assetCategoryId') && <p className="text-xs text-red-500 mt-1">{getError('assetCategoryId')}</p>}
          </div>

          <div><Label htmlFor="notes">Notes (Optional)</Label><Textarea id="notes" name="notes" value={formData.notes || ''} onChange={handleChange} disabled={isSubmitting} className="min-h-[60px] dark:bg-gray-700 dark:border-gray-600"/>{getError('notes') && <p className="text-xs text-red-500 mt-1">{getError('notes')}</p>}</div>

          <DialogFooter className="pt-5">
            <DialogClose asChild><Button type="button" variant="outline" onClick={onClose} className="dark:border-gray-600 hover:dark:bg-gray-700">Cancel</Button></DialogClose>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">{isSubmitting ? (profileToEdit ? 'Saving...' : 'Adding...') : (profileToEdit ? 'Save Changes' : 'Add Profile')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
