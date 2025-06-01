// src/components/balances/BalanceEntryForm.tsx
'use client';

import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { BalanceEntry, Account as FinancialAccount } from '@prisma/client';
import { z } from 'zod';

// Zod schema for client-side validation
const balanceEntryFormSchema = z.object({
  accountId: z.string().min(1, "Account ID is required."),
  entryDate: z.preprocess((arg) => {
    if (typeof arg === "string" && arg.match(/^\d{4}-\d{2}$/)) { // Expects "YYYY-MM"
        const [year, month] = arg.split('-').map(Number);
        if (year && month) return new Date(Date.UTC(year, month - 1, 1)); // Store as UTC date
    }
    if (arg instanceof Date) return arg; // Already a Date object
    return null; // Invalid or empty, let Zod handle
  }, z.date({ required_error: "Entry month/year is required." })),
  balanceOriginal: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number({ required_error: "Original balance is required." })
  ),
  currency: z.string().min(2, "Currency is required.").max(10, "Currency code too long."),
  exchangeRateToBase: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? null : (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number().positive("Exchange rate must be positive if provided.").nullable().optional()
  ),
  notes: z.string().nullable().optional().transform(val => val === "" ? null : val),
  locked: z.boolean().optional().default(false),
});

type BalanceEntryFormData = z.infer<typeof balanceEntryFormSchema>;

interface BalanceEntryFormProps {
  entryToEdit?: BalanceEntry | null;
  selectedAccount: Pick<FinancialAccount, 'id' | 'currency' | 'nickname'>; // Pass only necessary fields
  targetDateForNew?: Date;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function BalanceEntryForm({
  entryToEdit,
  selectedAccount,
  targetDateForNew,
  isOpen,
  onClose,
  onSave,
}: BalanceEntryFormProps) {
  const [formData, setFormData] = useState<Partial<BalanceEntryFormData>>({});
  const [errors, setErrors] = useState<z.ZodError<BalanceEntryFormData> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (entryToEdit) {
        setFormData({
          accountId: entryToEdit.accountId,
          // entryDate is YYYY-MM string for input, but stored as Date in state after first selection
          entryDate: entryToEdit.entryDate ? new Date(entryToEdit.entryDate) : undefined,
          balanceOriginal: entryToEdit.balanceOriginal ? Number(entryToEdit.balanceOriginal) : undefined,
          currency: entryToEdit.currency,
          exchangeRateToBase: entryToEdit.exchangeRateToBase ? Number(entryToEdit.exchangeRateToBase) : null,
          notes: entryToEdit.notes || null,
          locked: entryToEdit.locked,
        });
      } else {
        const initialDate = targetDateForNew || new Date();
        setFormData({
          accountId: selectedAccount.id,
          currency: selectedAccount.currency,
          entryDate: new Date(Date.UTC(initialDate.getFullYear(), initialDate.getMonth(), 1)),
          locked: false,
          balanceOriginal: undefined, exchangeRateToBase: null, notes: null,
        });
      }
      setErrors(null);
      setServerError(null);
    }
  }, [entryToEdit, selectedAccount, targetDateForNew, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        setFormData((prev) => ({ ...prev, [name]: checked }));
    } else if (type === 'month') {
        if (value) { // value is "YYYY-MM"
            const [year, month] = value.split('-').map(Number);
            // Store as Date object representing 1st of month UTC for consistency
            setFormData(prev => ({ ...prev, [name]: new Date(Date.UTC(year, month - 1, 1)) }));
        } else {
            setFormData(prev => ({ ...prev, [name]: undefined })); // Clear date if input is cleared
        }
    } else if (type === 'number') {
        setFormData((prev) => ({ ...prev, [name]: value === '' ? undefined : parseFloat(value) }));
    } else {
        setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors(null);
    setServerError(null);

    // Ensure data sent to Zod has correct types and values
    const dataToParse = {
        ...formData,
        accountId: selectedAccount.id,
        currency: selectedAccount.currency,
        // entryDate should be a Date object from state if handled by type="month" and handleChange
        // or from initial setup. Zod preprocess will handle string if somehow it's still a string.
        balanceOriginal: formData.balanceOriginal ? Number(formData.balanceOriginal) : undefined,
        exchangeRateToBase: formData.exchangeRateToBase ? Number(formData.exchangeRateToBase) : null,
    };

    const result = balanceEntryFormSchema.safeParse(dataToParse);
    if (!result.success) {
      setErrors(result.error);
      return;
    }

    // Handle locked entries: only allow 'notes' and 'locked' to be changed
    if (entryToEdit && entryToEdit.locked) {
        const restrictedData: Partial<BalanceEntryFormData> = {};
        if (result.data.notes !== entryToEdit.notes) restrictedData.notes = result.data.notes;
        if (result.data.locked !== entryToEdit.locked) restrictedData.locked = result.data.locked;

        if (Object.keys(result.data).some(key =>
            !['notes', 'locked', 'accountId', 'entryDate', 'currency'].includes(key) &&
            (result.data as any)[key] !== undefined &&
            (result.data as any)[key] !== (entryToEdit as any)[key]
        ) && (Object.keys(restrictedData).length === 0 && result.data.notes === entryToEdit.notes && result.data.locked === entryToEdit.locked ) ) {
            // This condition tries to check if any *other* field was attempted to be changed
            // For simplicity, if locked, we only send notes and locked status from the form.
            // The API will handle the actual restriction.
            // Here, we just ensure we don't send other fields if locked.
        }
    }


    setIsSubmitting(true);
    const method = entryToEdit ? 'PUT' : 'POST';
    const url = entryToEdit ? `/api/balance-entries/${entryToEdit.id}` : '/api/balance-entries';

    // For locked entries, only send notes and locked status if they are the only things changed.
    // The API should enforce this strictly. Here, we send what Zod validated unless we add more complex logic.
    let payload = result.data;
    if (entryToEdit && entryToEdit.locked) {
        payload = { // Send only these if locked, ensuring other fields are not accidentally changed
            notes: result.data.notes,
            locked: result.data.locked,
            // Include identifiers if PUT requires them, though typically in URL
            // accountId: result.data.accountId,
            // entryDate: result.data.entryDate,
            // currency: result.data.currency,
        } as BalanceEntryFormData; // Cast needed as it's a partial update
    }


    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const responseData = await response.json();
      if (!response.ok) {
        const message = Array.isArray(responseData.error)
          ? responseData.error.map((e: { path: (string|number)[]; message: string; }) => `${e.path.join('.')}: ${e.message}`).join('; ')
          : (responseData.error?.message || responseData.error || 'Failed to save balance entry');
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

  const getError = (field: keyof BalanceEntryFormData) => errors?.errors.find(e => e.path.includes(field))?.message;

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
        <DialogHeader><DialogTitle>{entryToEdit ? 'Edit Balance Entry' : 'Add New Balance Entry'}</DialogTitle></DialogHeader>
        <p className="text-sm text-gray-500 dark:text-gray-400 -mt-2 mb-2">For Account: {selectedAccount.nickname} ({selectedAccount.currency})</p>
        <form onSubmit={handleSubmit} className="space-y-3 py-4 max-h-[70vh] overflow-y-auto pr-2 sm:pr-4">
          {serverError && <p className="text-sm text-red-500 bg-red-100 dark:bg-red-900/30 dark:text-red-200 p-3 rounded-md">{serverError}</p>}

          <div>
            <Label htmlFor="entryDate">Entry Month & Year</Label>
            <Input id="entryDate" name="entryDate" type="month"
                   value={formData.entryDate ? new Date(formData.entryDate).toISOString().substring(0,7) : ''}
                   onChange={handleChange}
                   disabled={isSubmitting || !!entryToEdit} // Cannot change date of existing entry
                   className="dark:bg-gray-700 dark:border-gray-600"
            />
            {getError('entryDate') && <p className="text-xs text-red-500 mt-1">{getError('entryDate')}</p>}
          </div>

          <div><Label htmlFor="balanceOriginal">Balance (in {selectedAccount.currency})</Label><Input id="balanceOriginal" name="balanceOriginal" type="number" step="any" value={formData.balanceOriginal ?? ''} onChange={handleChange} disabled={isSubmitting || (entryToEdit?.locked && formData.locked === entryToEdit?.locked)} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('balanceOriginal') && <p className="text-xs text-red-500 mt-1">{getError('balanceOriginal')}</p>}</div>

          <div><Label htmlFor="exchangeRateToBase">Exchange Rate to Base Currency (Optional)</Label><Input id="exchangeRateToBase" name="exchangeRateToBase" type="number" step="any" value={formData.exchangeRateToBase ?? ''} onChange={handleChange} placeholder="e.g., 1.0 if account currency is base" disabled={isSubmitting || (entryToEdit?.locked && formData.locked === entryToEdit?.locked)} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('exchangeRateToBase') && <p className="text-xs text-red-500 mt-1">{getError('exchangeRateToBase')}</p>}</div>

          <div><Label htmlFor="notes">Notes (Optional)</Label><Textarea id="notes" name="notes" value={formData.notes || ''} onChange={handleChange} disabled={isSubmitting && !(entryToEdit?.locked && formData.locked !== entryToEdit?.locked) } className="min-h-[60px] dark:bg-gray-700 dark:border-gray-600"/>{getError('notes') && <p className="text-xs text-red-500 mt-1">{getError('notes')}</p>}</div>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox id="locked" name="locked" checked={formData.locked || false} onCheckedChange={(checkedState) => setFormData(prev => ({...prev, locked: Boolean(checkedState)}))} disabled={isSubmitting}/>
            <Label htmlFor="locked" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Lock this entry (prevents edits to amounts)</Label>
          </div>

          <DialogFooter className="pt-5">
            <DialogClose asChild><Button type="button" variant="outline" onClick={onClose} className="dark:border-gray-600 hover:dark:bg-gray-700">Cancel</Button></DialogClose>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">{isSubmitting ? (entryToEdit ? 'Saving...' : 'Adding...') : (entryToEdit ? 'Save Changes' : 'Add Entry')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
