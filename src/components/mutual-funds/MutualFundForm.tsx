// src/components/mutual-funds/MutualFundForm.tsx
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
import { MutualFund, AssetCategory, Account as FinancialAccount, AccountType } from '@prisma/client';
import { z } from 'zod';

// Zod schema for client-side validation
const mutualFundFormSchema = z.object({
  fundName: z.string().min(1, "Fund name is required."),
  folioNumber: z.string().optional().nullable().transform(val => val === "" ? null : val),
  purchaseDate: z.preprocess((arg) => {
    if (typeof arg === "string" && arg) return new Date(arg);
    if (arg instanceof Date) return arg;
    return null; // Allow null if field is truly optional or cleared
  }, z.date().nullable().optional()),
  unitsHeld: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number({ required_error: "Units held is required." }).positive("Units must be positive.")
  ),
  averageCostPerUnit: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number({ required_error: "Average cost is required." }).positive("Average cost must be positive.")
  ),
  currentNAV: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? null : (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number().positive("NAV must be positive if provided.").nullable().optional()
  ),
  currency: z.string().min(2, "Currency is required.").max(10, "Currency code too long."),
  assetCategoryId: z.string().optional().nullable().transform(val => val === "" || val === "none" ? null : val),
  linkedAccountId: z.string().optional().nullable().transform(val => val === "" || val === "none" ? null : val),
  notes: z.string().optional().nullable().transform(val => val === "" ? null : val),
});

type MutualFundFormData = z.infer<typeof mutualFundFormSchema>;

interface MutualFundFormProps {
  fundToEdit?: MutualFund | null;
  assetCategories: Pick<AssetCategory, 'id' | 'name' | 'type'>[];
  userAccounts: Pick<FinancialAccount, 'id' | 'nickname' | 'accountType' | 'bankName'>[];
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function MutualFundForm({
  fundToEdit,
  assetCategories,
  userAccounts,
  isOpen,
  onClose,
  onSave,
}: MutualFundFormProps) {
  const [formData, setFormData] = useState<Partial<MutualFundFormData>>({});
  const [errors, setErrors] = useState<z.ZodError<MutualFundFormData> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (fundToEdit) {
        setFormData({
          ...fundToEdit,
          purchaseDate: fundToEdit.purchaseDate ? new Date(fundToEdit.purchaseDate) : null,
          unitsHeld: fundToEdit.unitsHeld ? Number(fundToEdit.unitsHeld) : undefined,
          averageCostPerUnit: fundToEdit.averageCostPerUnit ? Number(fundToEdit.averageCostPerUnit) : undefined,
          currentNAV: fundToEdit.currentNAV ? Number(fundToEdit.currentNAV) : null,
          assetCategoryId: fundToEdit.assetCategoryId || undefined,
          linkedAccountId: fundToEdit.linkedAccountId || undefined,
        });
      } else {
        setFormData({
            currency: 'INR', // Default for new fund
            fundName: '', folioNumber: '', purchaseDate: null, unitsHeld: undefined,
            averageCostPerUnit: undefined, currentNAV: null, assetCategoryId: undefined,
            linkedAccountId: undefined, notes: ''
        });
      }
      setErrors(null);
      setServerError(null);
    }
  }, [fundToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'number') {
        setFormData((prev) => ({ ...prev, [name]: value === '' ? undefined : parseFloat(value) }));
    } else {
        setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSelectChange = (name: keyof MutualFundFormData, value: string) => {
    const valToSet = (value === "none" || value === "") ? null : value;
    setFormData((prev) => ({ ...prev, [name]: valToSet as any }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors(null);
    setServerError(null);

    // Prepare data for Zod parsing, ensuring numeric types and nulls are correct
    const dataToParse = {
        ...formData,
        unitsHeld: formData.unitsHeld ? Number(formData.unitsHeld) : undefined,
        averageCostPerUnit: formData.averageCostPerUnit ? Number(formData.averageCostPerUnit) : undefined,
        currentNAV: formData.currentNAV ? Number(formData.currentNAV) : null,
        purchaseDate: formData.purchaseDate || null, // Ensure null if empty
        // Transforms in Zod schema will handle empty strings for nullable foreign keys
    };
    if (formData.currency) { // Uppercase currency before validation
        dataToParse.currency = formData.currency.toUpperCase();
    }


    const result = mutualFundFormSchema.safeParse(dataToParse);
    if (!result.success) {
      setErrors(result.error);
      return;
    }

    setIsSubmitting(true);
    const method = fundToEdit ? 'PUT' : 'POST';
    const url = fundToEdit
      ? `/api/mutual-funds/${fundToEdit.id}`
      : '/api/mutual-funds';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.data), // Send validated and transformed data
      });
      const responseData = await response.json();
      if (!response.ok) {
        const message = Array.isArray(responseData.error)
          ? responseData.error.map((e: { path: (string|number)[]; message: string; }) => `${e.path.join('.')}: ${e.message}`).join('; ')
          : (responseData.error?.message || responseData.error || 'Failed to save mutual fund');
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

  const getError = (field: keyof MutualFundFormData) => errors?.errors.find(e => e.path.includes(field))?.message;

  if (!isOpen) return null;

  const dematAccounts = userAccounts.filter(acc =>
    acc.accountType === AccountType.DEMAT ||
    acc.accountType === AccountType.SAVINGS || // Allow savings as some might use it
    acc.accountType === AccountType.CHECKING
  );
  const relevantAssetCategories = assetCategories.filter(cat => cat.type === AssetType.ASSET);


  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
        <DialogHeader><DialogTitle>{fundToEdit ? 'Edit Mutual Fund' : 'Add New Mutual Fund'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-4 max-h-[75vh] overflow-y-auto pr-2 sm:pr-4">
          {serverError && <p className="text-sm text-red-500 bg-red-100 dark:bg-red-900/30 dark:text-red-200 p-3 rounded-md">{serverError}</p>}

          <div><Label htmlFor="fundName">Fund Name</Label><Input id="fundName" name="fundName" value={formData.fundName || ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('fundName') && <p className="text-xs text-red-500 mt-1">{getError('fundName')}</p>}</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label htmlFor="folioNumber">Folio Number (Optional)</Label><Input id="folioNumber" name="folioNumber" value={formData.folioNumber || ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('folioNumber') && <p className="text-xs text-red-500 mt-1">{getError('folioNumber')}</p>}</div>
            <div><Label htmlFor="purchaseDate">Purchase Date (Optional)</Label><Input id="purchaseDate" name="purchaseDate" type="date" value={formData.purchaseDate ? (formData.purchaseDate instanceof Date ? formData.purchaseDate.toISOString().split('T')[0] : String(formData.purchaseDate)) : ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('purchaseDate') && <p className="text-xs text-red-500 mt-1">{getError('purchaseDate')}</p>}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><Label htmlFor="unitsHeld">Units Held</Label><Input id="unitsHeld" name="unitsHeld" type="number" step="any" value={formData.unitsHeld ?? ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('unitsHeld') && <p className="text-xs text-red-500 mt-1">{getError('unitsHeld')}</p>}</div>
            <div><Label htmlFor="averageCostPerUnit">Avg. Cost / Unit</Label><Input id="averageCostPerUnit" name="averageCostPerUnit" type="number" step="any" value={formData.averageCostPerUnit ?? ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('averageCostPerUnit') && <p className="text-xs text-red-500 mt-1">{getError('averageCostPerUnit')}</p>}</div>
            <div><Label htmlFor="currentNAV">Current NAV (Optional)</Label><Input id="currentNAV" name="currentNAV" type="number" step="any" value={formData.currentNAV ?? ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('currentNAV') && <p className="text-xs text-red-500 mt-1">{getError('currentNAV')}</p>}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label htmlFor="currency">Currency</Label><Input id="currency" name="currency" value={formData.currency || ''} onChange={handleChange} disabled={isSubmitting} maxLength={10} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('currency') && <p className="text-xs text-red-500 mt-1">{getError('currency')}</p>}</div>
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
          </div>

          <div>
            <Label htmlFor="linkedAccountId">Linked Demat/Bank Account (Optional)</Label>
            <Select name="linkedAccountId" value={formData.linkedAccountId || 'none'} onValueChange={(value) => handleSelectChange('linkedAccountId', value)} disabled={isSubmitting}>
                <SelectTrigger id="linkedAccountId" className="dark:bg-gray-700 dark:border-gray-600"><SelectValue placeholder="Select Demat/Bank account..." /></SelectTrigger>
                <SelectContent className="dark:bg-gray-900 border-gray-700">
                    <SelectItem value="none" className="dark:focus:bg-gray-700">None</SelectItem>
                    {dematAccounts.map(acc => <SelectItem key={acc.id} value={acc.id} className="dark:focus:bg-gray-700">{acc.nickname} ({acc.accountType}) - {acc.bankName}</SelectItem>)}
                </SelectContent>
            </Select>
            {getError('linkedAccountId') && <p className="text-xs text-red-500 mt-1">{getError('linkedAccountId')}</p>}
          </div>

          <div><Label htmlFor="notes">Notes (Optional)</Label><Textarea id="notes" name="notes" value={formData.notes || ''} onChange={handleChange} disabled={isSubmitting} className="min-h-[60px] dark:bg-gray-700 dark:border-gray-600"/>{getError('notes') && <p className="text-xs text-red-500 mt-1">{getError('notes')}</p>}</div>

          <DialogFooter className="pt-5">
            <DialogClose asChild><Button type="button" variant="outline" onClick={onClose} className="dark:border-gray-600 hover:dark:bg-gray-700">Cancel</Button></DialogClose>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">{isSubmitting ? (fundToEdit ? 'Saving...' : 'Adding...') : (fundToEdit ? 'Save Changes' : 'Add Fund')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
