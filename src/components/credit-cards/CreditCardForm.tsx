// src/components/credit-cards/CreditCardForm.tsx
'use client';

import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// import { Textarea } from "@/components/ui/textarea"; // Not used for notes in this version, using Input
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
import { CreditCard, CreditCardType, AssetCategory, AddressHistory, AssetType } from '@prisma/client';
import { z } from 'zod';

// Zod schema for client-side validation
const creditCardFormSchema = z.object({
  nickname: z.string().min(1, "Nickname is required."),
  cardType: z.nativeEnum(CreditCardType, { required_error: "Card type is required." }),
  lastFourDigits: z.string().length(4, "Must be exactly 4 digits.").regex(/^\d{4}$/, "Must be 4 digits."),
  issuingBank: z.string().min(1, "Issuing bank is required."),
  creditLimit: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number({ required_error: "Credit limit is required." }).positive("Credit limit must be positive.")
  ),
  // expiryDate is expected as YYYY-MM from input type="month"
  // Prisma expects a full DateTime object. We'll set it to the first day of that month.
  expiryDate: z.preprocess((arg) => {
    if (typeof arg === "string" && arg.match(/^\d{4}-\d{2}$/)) { // YYYY-MM format
      return new Date(arg + '-01T00:00:00Z'); // Use UTC to avoid timezone issues
    }
    if (arg instanceof Date) return arg;
    return null; // Let Zod catch if it's required and null
  }, z.date({ required_error: "Expiry date is required." })),
  billingAddressId: z.string().optional().nullable().transform(val => val === "" || val === "none" ? null : val),
  notes: z.string().optional().nullable(),
  assetCategoryId: z.string().optional().nullable().transform(val => val === "" || val === "none" ? null : val),
});

type CreditCardFormData = z.infer<typeof creditCardFormSchema>;

interface CreditCardFormProps {
  cardToEdit?: CreditCard | null;
  assetCategories: Pick<AssetCategory, 'id' | 'name' | 'type'>[];
  userAddresses: Pick<AddressHistory, 'id' | 'line1' | 'city' | 'type'>[];
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function CreditCardForm({
  cardToEdit,
  assetCategories,
  userAddresses,
  isOpen,
  onClose,
  onSave,
}: CreditCardFormProps) {
  const [formData, setFormData] = useState<Partial<CreditCardFormData>>({});
  const [errors, setErrors] = useState<z.ZodError<CreditCardFormData> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (cardToEdit) {
        setFormData({
          ...cardToEdit,
          creditLimit: cardToEdit.creditLimit ? Number(cardToEdit.creditLimit) : undefined,
          // Format expiryDate from DateTime to YYYY-MM string for input type="month"
          expiryDate: cardToEdit.expiryDate ? new Date(cardToEdit.expiryDate) : undefined,
          billingAddressId: cardToEdit.billingAddressId || undefined,
          assetCategoryId: cardToEdit.assetCategoryId || undefined,
        });
      } else {
        setFormData({
            cardType: CreditCardType.VISA, // Default type
            nickname: '', lastFourDigits: '', issuingBank: '', creditLimit: undefined, expiryDate: undefined,
            billingAddressId: undefined, notes: '', assetCategoryId: undefined
        });
      }
      setErrors(null);
      setServerError(null);
    }
  }, [cardToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
     if (name === 'creditLimit') {
        setFormData((prev) => ({ ...prev, [name]: value === '' ? undefined : parseFloat(value) }));
    } else {
        setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleExpiryDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target; // value is "YYYY-MM"
    if (value) { // value is "YYYY-MM"
        // To store as a Date object in state, consistent with Zod and Prisma
        setFormData(prev => ({ ...prev, [name]: new Date(value + '-01T00:00:00Z') }));
    } else {
        setFormData(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSelectChange = (name: keyof CreditCardFormData, value: string) => {
    const valToSet = (value === "none" || value === "") ? null : value;
    setFormData((prev) => ({ ...prev, [name]: valToSet as any }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors(null);
    setServerError(null);

    const dataToValidate = {
        ...formData,
        // Ensure numeric fields are numbers if not empty, or undefined
        creditLimit: formData.creditLimit ? Number(formData.creditLimit) : undefined,
        // Ensure date is a Date object or undefined
        expiryDate: formData.expiryDate ? new Date(formData.expiryDate) : undefined,
    };

    const result = creditCardFormSchema.safeParse(dataToValidate);
    if (!result.success) {
      setErrors(result.error);
      return;
    }

    setIsSubmitting(true);
    const method = cardToEdit ? 'PUT' : 'POST';
    const url = cardToEdit
      ? `/api/credit-cards/${cardToEdit.id}`
      : '/api/credit-cards';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.data), // Send validated and transformed data
      });
      const responseData = await response.json();
      if (!response.ok) {
        const message = Array.isArray(responseData.error)
          ? responseData.error.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ')
          : (responseData.error?.message || responseData.error || 'Failed to save credit card');
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

  const getError = (field: keyof CreditCardFormData) => errors?.errors.find(e => e.path.includes(field))?.message;

  if (!isOpen) return null;

  const liabilityCategories = assetCategories.filter(cat => cat.type === AssetType.LIABILITY);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
        <DialogHeader><DialogTitle>{cardToEdit ? 'Edit Credit Card' : 'Add New Credit Card'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-4 max-h-[75vh] overflow-y-auto pr-2 sm:pr-4">
          {serverError && <p className="text-sm text-red-500 bg-red-100 dark:bg-red-900/30 dark:text-red-200 p-3 rounded-md">{serverError}</p>}

          <div><Label htmlFor="nickname">Nickname</Label><Input id="nickname" name="nickname" value={formData.nickname || ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('nickname') && <p className="text-xs text-red-500 mt-1">{getError('nickname')}</p>}</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cardType">Card Type</Label>
              <Select name="cardType" value={formData.cardType || ''} onValueChange={(value) => handleSelectChange('cardType', value as CreditCardType)} disabled={isSubmitting}>
                <SelectTrigger id="cardType" className="dark:bg-gray-700 dark:border-gray-600"><SelectValue placeholder="Select type..." /></SelectTrigger>
                <SelectContent className="dark:bg-gray-900 border-gray-700">{Object.values(CreditCardType).map(type => <SelectItem key={type} value={type} className="dark:focus:bg-gray-700">{type.charAt(0) + type.slice(1).toLowerCase().replace('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
              {getError('cardType') && <p className="text-xs text-red-500 mt-1">{getError('cardType')}</p>}
            </div>
            <div><Label htmlFor="lastFourDigits">Last 4 Digits</Label><Input id="lastFourDigits" name="lastFourDigits" value={formData.lastFourDigits || ''} onChange={handleChange} disabled={isSubmitting} maxLength={4} pattern="\d{4}" className="dark:bg-gray-700 dark:border-gray-600"/>{getError('lastFourDigits') && <p className="text-xs text-red-500 mt-1">{getError('lastFourDigits')}</p>}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label htmlFor="issuingBank">Issuing Bank</Label><Input id="issuingBank" name="issuingBank" value={formData.issuingBank || ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('issuingBank') && <p className="text-xs text-red-500 mt-1">{getError('issuingBank')}</p>}</div>
            <div><Label htmlFor="creditLimit">Credit Limit</Label><Input id="creditLimit" name="creditLimit" type="number" step="any" value={formData.creditLimit ?? ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('creditLimit') && <p className="text-xs text-red-500 mt-1">{getError('creditLimit')}</p>}</div>
          </div>

          <div>
            <Label htmlFor="expiryDate">Expiry Date (MM/YYYY)</Label>
            <Input id="expiryDate" name="expiryDate" type="month"
                   value={formData.expiryDate ? (formData.expiryDate instanceof Date ? formData.expiryDate.toISOString().substring(0,7) : String(formData.expiryDate).substring(0,7)) : ''}
                   onChange={handleExpiryDateChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>
            {getError('expiryDate') && <p className="text-xs text-red-500 mt-1">{getError('expiryDate')}</p>}
          </div>

          <div>
            <Label htmlFor="billingAddressId">Billing Address (Optional)</Label>
            <Select name="billingAddressId" value={formData.billingAddressId || 'none'} onValueChange={(value) => handleSelectChange('billingAddressId', value)} disabled={isSubmitting}>
                <SelectTrigger id="billingAddressId" className="dark:bg-gray-700 dark:border-gray-600"><SelectValue placeholder="Select address..." /></SelectTrigger>
                <SelectContent className="dark:bg-gray-900 border-gray-700">
                    <SelectItem value="none" className="dark:focus:bg-gray-700">None</SelectItem>
                    {userAddresses.map(addr => <SelectItem key={addr.id} value={addr.id} className="dark:focus:bg-gray-700">{addr.line1}, {addr.city} ({addr.type})</SelectItem>)}
                </SelectContent>
            </Select>
            {getError('billingAddressId') && <p className="text-xs text-red-500 mt-1">{getError('billingAddressId')}</p>}
          </div>

          <div>
            <Label htmlFor="assetCategoryId">Category (Optional, Liability)</Label>
            <Select name="assetCategoryId" value={formData.assetCategoryId || 'none'} onValueChange={(value) => handleSelectChange('assetCategoryId', value)} disabled={isSubmitting}>
                <SelectTrigger id="assetCategoryId" className="dark:bg-gray-700 dark:border-gray-600"><SelectValue placeholder="Select category..." /></SelectTrigger>
                <SelectContent className="dark:bg-gray-900 border-gray-700">
                    <SelectItem value="none" className="dark:focus:bg-gray-700">None</SelectItem>
                    {liabilityCategories.map(cat => <SelectItem key={cat.id} value={cat.id} className="dark:focus:bg-gray-700">{cat.name}</SelectItem>)}
                </SelectContent>
            </Select>
            {getError('assetCategoryId') && <p className="text-xs text-red-500 mt-1">{getError('assetCategoryId')}</p>}
          </div>

          <div><Label htmlFor="notes">Notes (Optional)</Label><Input id="notes" name="notes" value={formData.notes || ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('notes') && <p className="text-xs text-red-500 mt-1">{getError('notes')}</p>}</div>

          <DialogFooter className="pt-5">
            <DialogClose asChild><Button type="button" variant="outline" onClick={onClose} className="dark:border-gray-600 hover:dark:bg-gray-700">Cancel</Button></DialogClose>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">{isSubmitting ? (cardToEdit ? 'Saving...' : 'Adding...') : (cardToEdit ? 'Save Changes' : 'Add Card')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
