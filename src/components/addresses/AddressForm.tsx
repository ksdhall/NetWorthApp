// src/components/addresses/AddressForm.tsx
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
} from "@/components/ui/dialog";
import { AddressType, AddressHistory } from '@prisma/client';
import { z } from 'zod';

// Zod schema for client-side validation
const addressFormSchema = z.object({
  type: z.nativeEnum(AddressType, { required_error: "Address type is required." }),
  line1: z.string().min(1, "Address line 1 is required."),
  line2: z.string().optional().nullable(),
  city: z.string().min(1, "City is required."),
  state: z.string().min(1, "State is required."),
  postalCode: z.string().min(1, "Postal code is required."),
  country: z.string().min(1, "Country is required."),
  fromDate: z.preprocess((arg) => {
    if (typeof arg === "string" && arg) return new Date(arg);
    if (arg instanceof Date) return arg;
    return null;
  }, z.date({ required_error: "From date is required." })),
  toDate: z.preprocess((arg) => {
    if (typeof arg === "string" && arg) return new Date(arg);
    if (arg instanceof Date) return arg;
    return null;
  }, z.date().nullable().optional()),
  isCurrent: z.boolean().optional().default(false),
  latitude: z.preprocess(val => (val === "" || val === null || val === undefined) ? null : Number(val), z.number().nullable().optional()),
  longitude: z.preprocess(val => (val === "" || val === null || val === undefined) ? null : Number(val), z.number().nullable().optional()),
});

type AddressFormData = z.infer<typeof addressFormSchema>;

interface AddressFormProps {
  addressToEdit?: AddressHistory | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void; // To refresh the list
}

export default function AddressForm({
  addressToEdit,
  isOpen,
  onClose,
  onSave,
}: AddressFormProps) {
  const [formData, setFormData] = useState<Partial<AddressFormData>>({});
  const [errors, setErrors] = useState<z.ZodError<AddressFormData> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
        if (addressToEdit) {
          setFormData({
            ...addressToEdit,
            fromDate: addressToEdit.fromDate ? new Date(addressToEdit.fromDate) : new Date(), // Ensure Date object
            toDate: addressToEdit.toDate ? new Date(addressToEdit.toDate) : null,
            latitude: addressToEdit.latitude ?? null,
            longitude: addressToEdit.longitude ?? null,
          });
        } else {
          setFormData({
            type: undefined, // Use undefined for Select placeholder
            line1: '', line2: '', city: '', state: '', postalCode: '', country: '',
            fromDate: new Date(),
            toDate: null,
            isCurrent: false,
            latitude: null,
            longitude: null
          });
        }
        setErrors(null);
        setServerError(null);
    }
  }, [addressToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
     if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        setFormData((prev) => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
        setFormData((prev) => ({ ...prev, [name]: value === '' ? null : Number(value) }));
    } else {
        setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSelectChange = (name: keyof AddressFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value as AddressType }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors(null);
    setServerError(null);

    // Ensure numeric fields are numbers or null
    const dataToParse = {
        ...formData,
        latitude: formData.latitude === '' || formData.latitude === undefined ? null : Number(formData.latitude),
        longitude: formData.longitude === '' || formData.longitude === undefined ? null : Number(formData.longitude),
        line2: formData.line2 || null, // Ensure empty string becomes null if schema expects it
    };

    const result = addressFormSchema.safeParse(dataToParse);
    if (!result.success) {
      setErrors(result.error);
      return;
    }

    setIsSubmitting(true);
    const method = addressToEdit ? 'PUT' : 'POST';
    const url = addressToEdit
      ? `/api/addresses/${addressToEdit.id}`
      : '/api/addresses';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const message = Array.isArray(errorData.error)
          ? errorData.error.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ')
          : (errorData.error?.message || errorData.error || 'Failed to save address');
        throw new Error(message);
      }

      onSave();
      onClose();
    } catch (err: any) {
      setServerError(err.message);
      console.error("Save error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getError = (field: keyof AddressFormData) => {
    return errors?.errors.find(e => e.path.includes(field))?.message;
  }

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
        <DialogHeader>
          <DialogTitle>
            {addressToEdit ? 'Edit Address' : 'Add New Address'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-4 max-h-[70vh] overflow-y-auto pr-2 sm:pr-4">
          {serverError && <p className="text-sm text-red-500 bg-red-100 dark:bg-red-900/30 dark:text-red-200 p-3 rounded-md">{serverError}</p>}

          <div>
            <Label htmlFor="type">Address Type</Label>
            <Select
              name="type"
              value={formData.type || ''}
              onValueChange={(value) => handleSelectChange('type', value)}
              disabled={isSubmitting}
            >
              <SelectTrigger id="type" className="w-full dark:bg-gray-700 dark:border-gray-600">
                <SelectValue placeholder="Select address type" />
              </SelectTrigger>
              <SelectContent className="dark:bg-gray-900 border-gray-700">
                {Object.values(AddressType).map((type) => (
                  <SelectItem key={type} value={type} className="dark:focus:bg-gray-700">
                    {type.charAt(0) + type.slice(1).toLowerCase().replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {getError('type') && <p className="text-xs text-red-500 mt-1">{getError('type')}</p>}
          </div>

          <div><Label htmlFor="line1">Address Line 1</Label><Input id="line1" name="line1" value={formData.line1 || ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('line1') && <p className="text-xs text-red-500 mt-1">{getError('line1')}</p>}</div>
          <div><Label htmlFor="line2">Address Line 2</Label><Input id="line2" name="line2" value={formData.line2 || ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('line2') && <p className="text-xs text-red-500 mt-1">{getError('line2')}</p>}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label htmlFor="city">City</Label><Input id="city" name="city" value={formData.city || ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('city') && <p className="text-xs text-red-500 mt-1">{getError('city')}</p>}</div>
            <div><Label htmlFor="state">State/Province</Label><Input id="state" name="state" value={formData.state || ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('state') && <p className="text-xs text-red-500 mt-1">{getError('state')}</p>}</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label htmlFor="postalCode">Postal Code</Label><Input id="postalCode" name="postalCode" value={formData.postalCode || ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('postalCode') && <p className="text-xs text-red-500 mt-1">{getError('postalCode')}</p>}</div>
            <div><Label htmlFor="country">Country</Label><Input id="country" name="country" value={formData.country || ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('country') && <p className="text-xs text-red-500 mt-1">{getError('country')}</p>}</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label htmlFor="fromDate">From Date</Label><Input id="fromDate" name="fromDate" type="date" value={formData.fromDate ? (formData.fromDate instanceof Date ? formData.fromDate.toISOString().split('T')[0] : String(formData.fromDate)) : ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('fromDate') && <p className="text-xs text-red-500 mt-1">{getError('fromDate')}</p>}</div>
            <div><Label htmlFor="toDate">To Date (Optional)</Label><Input id="toDate" name="toDate" type="date" value={formData.toDate ? (formData.toDate instanceof Date ? formData.toDate.toISOString().split('T')[0] : String(formData.toDate)) : ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('toDate') && <p className="text-xs text-red-500 mt-1">{getError('toDate')}</p>}</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label htmlFor="latitude">Latitude (Optional)</Label><Input id="latitude" name="latitude" type="number" step="any" value={formData.latitude ?? ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('latitude') && <p className="text-xs text-red-500 mt-1">{getError('latitude')}</p>}</div>
            <div><Label htmlFor="longitude">Longitude (Optional)</Label><Input id="longitude" name="longitude" type="number" step="any" value={formData.longitude ?? ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('longitude') && <p className="text-xs text-red-500 mt-1">{getError('longitude')}</p>}</div>
          </div>
          <div className="flex items-center space-x-2 pt-2">
            <Checkbox id="isCurrent" name="isCurrent" checked={formData.isCurrent || false} onCheckedChange={(checkedState) => { const isChecked = checkedState === true; setFormData((prev) => ({ ...prev, isCurrent: isChecked }));}} disabled={isSubmitting} className="dark:border-gray-500 data-[state=checked]:dark:bg-blue-500"/>
            <Label htmlFor="isCurrent" className="text-sm font-medium leading-none text-gray-700 dark:text-gray-300">Set as current address</Label>
          </div>

          <DialogFooter className="pt-6">
            <DialogClose asChild><Button type="button" variant="outline" onClick={onClose} className="dark:border-gray-600 hover:dark:bg-gray-700">Cancel</Button></DialogClose>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">{isSubmitting ? (addressToEdit ? 'Saving...' : 'Adding...') : (addressToEdit ? 'Save Changes' : 'Add Address')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
