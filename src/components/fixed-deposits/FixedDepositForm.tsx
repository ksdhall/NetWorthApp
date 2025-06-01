// src/components/fixed-deposits/FixedDepositForm.tsx
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
import { FixedDeposit, AssetCategory, Account as FinancialAccount, PayoutFrequency, AccountType, AssetType } from '@prisma/client';
import { z } from 'zod';

// Zod schema for client-side validation
const fixedDepositFormSchema = z.object({
  bankName: z.string().min(1, "Bank name is required."),
  branch: z.string().optional().nullable().transform(val => val === "" ? null : val),
  fdAccountNumber: z.string().optional().nullable().transform(val => val === "" ? null : val),
  principalAmount: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number({ required_error: "Principal amount is required." }).positive("Principal must be positive.")
  ),
  interestRate: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number({ required_error: "Interest rate is required." }).positive("Rate must be positive.")
  ),
  startDate: z.preprocess((arg) => {
    if (typeof arg === "string" && arg) return new Date(arg); if (arg instanceof Date) return arg; return null;
  }, z.date({ required_error: "Start date is required." })),
  maturityDate: z.preprocess((arg) => {
    if (typeof arg === "string" && arg) return new Date(arg); if (arg instanceof Date) return arg; return null;
  }, z.date({ required_error: "Maturity date is required." })),
  payoutFrequency: z.nativeEnum(PayoutFrequency, { required_error: "Payout frequency is required."}),
  currency: z.string().min(2, "Currency is required.").max(10, "Currency code too long."),
  assetCategoryId: z.string().optional().nullable().transform(val => val === "" || val === "none" ? null : val),
  linkedAccountId: z.string().optional().nullable().transform(val => val === "" || val === "none" ? null : val),
  notes: z.string().optional().nullable().transform(val => val === "" ? null : val),
}).refine(data => {
    if (data.startDate && data.maturityDate) {
        return data.maturityDate > data.startDate;
    }
    return true;
}, {
    message: "Maturity date must be after start date.",
    path: ["maturityDate"],
});

type FixedDepositFormData = z.infer<typeof fixedDepositFormSchema>;

interface FixedDepositFormProps {
  fdToEdit?: FixedDeposit | null;
  assetCategories: Pick<AssetCategory, 'id' | 'name' | 'type'>[];
  userAccounts: Pick<FinancialAccount, 'id' | 'nickname' | 'accountType' | 'bankName'>[];
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function FixedDepositForm({
  fdToEdit,
  assetCategories,
  userAccounts,
  isOpen,
  onClose,
  onSave,
}: FixedDepositFormProps) {
  const [formData, setFormData] = useState<Partial<FixedDepositFormData>>({});
  const [errors, setErrors] = useState<z.ZodError<FixedDepositFormData> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (fdToEdit) {
        setFormData({
          ...fdToEdit,
          principalAmount: fdToEdit.principalAmount ? Number(fdToEdit.principalAmount) : undefined,
          interestRate: fdToEdit.interestRate ? Number(fdToEdit.interestRate) : undefined,
          startDate: fdToEdit.startDate ? new Date(fdToEdit.startDate) : new Date(), // Default to now if null
          maturityDate: fdToEdit.maturityDate ? new Date(fdToEdit.maturityDate) : new Date(), // Default to now if null
          assetCategoryId: fdToEdit.assetCategoryId || undefined,
          linkedAccountId: fdToEdit.linkedAccountId || undefined,
        });
      } else {
        setFormData({
            currency: 'INR',
            payoutFrequency: PayoutFrequency.ON_MATURITY,
            startDate: new Date(),
            maturityDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), // Default maturity 1 year from now
            bankName: '', branch: '', fdAccountNumber: '', principalAmount: undefined, interestRate: undefined,
            assetCategoryId: undefined, linkedAccountId: undefined, notes: ''
        });
      }
      setErrors(null);
      setServerError(null);
    }
  }, [fdToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'number') {
        setFormData((prev) => ({ ...prev, [name]: value === '' ? undefined : parseFloat(value) }));
    } else {
        setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSelectChange = (name: keyof FixedDepositFormData, value: string) => {
    const valToSet = (value === "none" || value === "") ? null : value;
    setFormData((prev) => ({ ...prev, [name]: valToSet as any }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors(null);
    setServerError(null);

    const dataToParse = {
        ...formData,
        principalAmount: formData.principalAmount ? Number(formData.principalAmount) : undefined,
        interestRate: formData.interestRate ? Number(formData.interestRate) : undefined,
        startDate: formData.startDate || null, // Zod expects Date or null from preprocess
        maturityDate: formData.maturityDate || null,
    };
    if (formData.currency) {
        dataToParse.currency = formData.currency.toUpperCase();
    }

    const result = fixedDepositFormSchema.safeParse(dataToParse);
    if (!result.success) {
      setErrors(result.error);
      return;
    }

    setIsSubmitting(true);
    const method = fdToEdit ? 'PUT' : 'POST';
    const url = fdToEdit ? `/api/fixed-deposits/${fdToEdit.id}` : '/api/fixed-deposits';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.data),
      });
      const responseData = await response.json();
      if (!response.ok) {
        const message = Array.isArray(responseData.error)
          ? responseData.error.map((e: { path: (string|number)[]; message: string; }) => `${e.path.join('.')}: ${e.message}`).join('; ')
          : (responseData.error?.message || responseData.error || 'Failed to save fixed deposit');
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

  const getError = (field: keyof FixedDepositFormData) => errors?.errors.find(e => e.path.includes(field))?.message;

  if (!isOpen) return null;

  const suitableLinkedAccounts = userAccounts.filter(acc =>
    [AccountType.SAVINGS, AccountType.CHECKING, AccountType.NRI].includes(acc.accountType)
  );
  const relevantAssetCategories = assetCategories.filter(cat => cat.type === AssetType.ASSET);


  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
        <DialogHeader><DialogTitle>{fdToEdit ? 'Edit Fixed Deposit' : 'Add New Fixed Deposit'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-4 max-h-[75vh] overflow-y-auto pr-2 sm:pr-4">
          {serverError && <p className="text-sm text-red-500 bg-red-100 dark:bg-red-900/30 dark:text-red-200 p-3 rounded-md">{serverError}</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label htmlFor="bankName">Bank Name</Label><Input id="bankName" name="bankName" value={formData.bankName || ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('bankName') && <p className="text-xs text-red-500 mt-1">{getError('bankName')}</p>}</div>
            <div><Label htmlFor="branch">Branch (Optional)</Label><Input id="branch" name="branch" value={formData.branch || ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('branch') && <p className="text-xs text-red-500 mt-1">{getError('branch')}</p>}</div>
          </div>
          <div><Label htmlFor="fdAccountNumber">FD Account Number (Optional)</Label><Input id="fdAccountNumber" name="fdAccountNumber" value={formData.fdAccountNumber || ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('fdAccountNumber') && <p className="text-xs text-red-500 mt-1">{getError('fdAccountNumber')}</p>}</div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><Label htmlFor="principalAmount">Principal Amount</Label><Input id="principalAmount" name="principalAmount" type="number" step="any" value={formData.principalAmount ?? ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('principalAmount') && <p className="text-xs text-red-500 mt-1">{getError('principalAmount')}</p>}</div>
            <div><Label htmlFor="interestRate">Interest Rate (% p.a.)</Label><Input id="interestRate" name="interestRate" type="number" step="0.01" value={formData.interestRate ?? ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('interestRate') && <p className="text-xs text-red-500 mt-1">{getError('interestRate')}</p>}</div>
            <div><Label htmlFor="currency">Currency</Label><Input id="currency" name="currency" value={formData.currency || ''} onChange={handleChange} disabled={isSubmitting} maxLength={10} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('currency') && <p className="text-xs text-red-500 mt-1">{getError('currency')}</p>}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label htmlFor="startDate">Start Date</Label><Input id="startDate" name="startDate" type="date" value={formData.startDate ? (formData.startDate instanceof Date ? formData.startDate.toISOString().split('T')[0] : String(formData.startDate)) : ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('startDate') && <p className="text-xs text-red-500 mt-1">{getError('startDate')}</p>}</div>
            <div><Label htmlFor="maturityDate">Maturity Date</Label><Input id="maturityDate" name="maturityDate" type="date" value={formData.maturityDate ? (formData.maturityDate instanceof Date ? formData.maturityDate.toISOString().split('T')[0] : String(formData.maturityDate)) : ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('maturityDate') && <p className="text-xs text-red-500 mt-1">{getError('maturityDate')}</p>}</div>
          </div>

          <div>
            <Label htmlFor="payoutFrequency">Payout Frequency</Label>
            <Select name="payoutFrequency" value={formData.payoutFrequency || ''} onValueChange={(value) => handleSelectChange('payoutFrequency', value as PayoutFrequency)} disabled={isSubmitting}>
              <SelectTrigger id="payoutFrequency" className="dark:bg-gray-700 dark:border-gray-600"><SelectValue placeholder="Select frequency..." /></SelectTrigger>
              <SelectContent className="dark:bg-gray-900 border-gray-700">{Object.values(PayoutFrequency).map(freq => <SelectItem key={freq} value={freq} className="dark:focus:bg-gray-700">{freq.charAt(0) + freq.slice(1).toLowerCase().replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
            </Select>
            {getError('payoutFrequency') && <p className="text-xs text-red-500 mt-1">{getError('payoutFrequency')}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label htmlFor="assetCategoryId">Category (Optional)</Label><Select name="assetCategoryId" value={formData.assetCategoryId || 'none'} onValueChange={(value) => handleSelectChange('assetCategoryId', value)} disabled={isSubmitting}><SelectTrigger id="assetCategoryId" className="dark:bg-gray-700 dark:border-gray-600"><SelectValue placeholder="Select category..." /></SelectTrigger><SelectContent className="dark:bg-gray-900 border-gray-700"><SelectItem value="none" className="dark:focus:bg-gray-700">None</SelectItem>{relevantAssetCategories.map(cat => <SelectItem key={cat.id} value={cat.id} className="dark:focus:bg-gray-700">{cat.name}</SelectItem>)}</SelectContent></Select>{getError('assetCategoryId') && <p className="text-xs text-red-500 mt-1">{getError('assetCategoryId')}</p>}</div>
            <div><Label htmlFor="linkedAccountId">Linked Account (Optional)</Label><Select name="linkedAccountId" value={formData.linkedAccountId || 'none'} onValueChange={(value) => handleSelectChange('linkedAccountId', value)} disabled={isSubmitting}><SelectTrigger id="linkedAccountId" className="dark:bg-gray-700 dark:border-gray-600"><SelectValue placeholder="Select account..." /></SelectTrigger><SelectContent className="dark:bg-gray-900 border-gray-700"><SelectItem value="none" className="dark:focus:bg-gray-700">None</SelectItem>{suitableLinkedAccounts.map(acc => <SelectItem key={acc.id} value={acc.id} className="dark:focus:bg-gray-700">{acc.nickname} ({acc.accountType}) - {acc.bankName}</SelectItem>)}</SelectContent></Select>{getError('linkedAccountId') && <p className="text-xs text-red-500 mt-1">{getError('linkedAccountId')}</p>}</div>
          </div>

          <div><Label htmlFor="notes">Notes (Optional)</Label><Textarea id="notes" name="notes" value={formData.notes || ''} onChange={handleChange} disabled={isSubmitting} className="min-h-[60px] dark:bg-gray-700 dark:border-gray-600"/>{getError('notes') && <p className="text-xs text-red-500 mt-1">{getError('notes')}</p>}</div>

          <DialogFooter className="pt-5">
            <DialogClose asChild><Button type="button" variant="outline" onClick={onClose} className="dark:border-gray-600 hover:dark:bg-gray-700">Cancel</Button></DialogClose>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">{isSubmitting ? (fdToEdit ? 'Saving...' : 'Adding...') : (fdToEdit ? 'Save Changes' : 'Add Fixed Deposit')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
