// src/components/accounts/AccountForm.tsx
'use client';

import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea"; // For notes
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
import { Account, AccountType, AssetCategory, AddressHistory } from '@prisma/client';
import { z } from 'zod';

// Zod schema for client-side validation
const accountFormSchema = z.object({
  nickname: z.string().min(1, "Nickname is required."),
  accountType: z.nativeEnum(AccountType, { required_error: "Account type is required." }),
  currency: z.string().min(2, "Currency is required (e.g., USD).").max(10, "Currency code too long."), // Max 10 for flexibility
  bankName: z.string().optional().nullable(),
  branch: z.string().optional().nullable(),
  accountNumberEncrypted: z.string().optional().nullable(),
  ifscSwift: z.string().optional().nullable(),
  linkedAddressId: z.string().optional().nullable(),
  linkedPhoneNumber: z.string().optional().nullable(),
  onlineLoginUsernameEncrypted: z.string().optional().nullable(),
  onlineLoginPasswordEncrypted: z.string().optional().nullable(),
  twoFactorMethod: z.string().optional().nullable(),
  assetCategoryId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type AccountFormData = z.infer<typeof accountFormSchema>;

interface AccountFormProps {
  accountToEdit?: Account | null; // Use Prisma's Account type directly
  assetCategories: Pick<AssetCategory, 'id' | 'name' | 'type'>[]; // Expect only id and name for dropdown
  userAddresses: Pick<AddressHistory, 'id' | 'line1' | 'city' | 'type'>[]; // Expect relevant fields for dropdown
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function AccountForm({
  accountToEdit,
  assetCategories,
  userAddresses,
  isOpen,
  onClose,
  onSave,
}: AccountFormProps) {
  const [formData, setFormData] = useState<Partial<AccountFormData>>({});
  const [errors, setErrors] = useState<z.ZodError<AccountFormData> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (accountToEdit) {
        setFormData({
          ...accountToEdit,
          // Ensure IDs are correctly set for select components, or undefined if null
          linkedAddressId: accountToEdit.linkedAddressId || undefined,
          assetCategoryId: accountToEdit.assetCategoryId || undefined,
        });
      } else {
        setFormData({
          accountType: AccountType.SAVINGS, // Default type
          currency: 'USD', // Default currency
          nickname: '', bankName: '', branch: '', accountNumberEncrypted: '', ifscSwift: '',
          linkedAddressId: undefined, linkedPhoneNumber: '', onlineLoginUsernameEncrypted: '',
          onlineLoginPasswordEncrypted: '', twoFactorMethod: '', assetCategoryId: undefined, notes: ''
        });
      }
      setErrors(null);
      setServerError(null);
    }
  }, [accountToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: keyof AccountFormData, value: string) => {
    const valToSet = (value === "none" || value === "") ? null : value;
    if (name === 'accountType') {
      setFormData((prev) => ({ ...prev, [name]: valToSet as AccountType | null }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: valToSet }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors(null);
    setServerError(null);

    // Prepare data for Zod parsing: ensure empty strings for nullable fields become null
    const processedFormData: Partial<AccountFormData> = { ...formData };
    for (const key in processedFormData) {
        if (processedFormData[key] === '') {
            const fieldSchema = accountFormSchema.shape[key as keyof AccountFormData];
            if (fieldSchema && fieldSchema.isOptional() && fieldSchema.isNullable()) {
                 (processedFormData as any)[key] = null;
            }
        }
    }
    if (processedFormData.currency) {
        processedFormData.currency = processedFormData.currency.toUpperCase();
    }


    const result = accountFormSchema.safeParse(processedFormData);
    if (!result.success) {
      setErrors(result.error);
      return;
    }

    setIsSubmitting(true);
    const method = accountToEdit ? 'PUT' : 'POST';
    const url = accountToEdit
      ? `/api/accounts/${accountToEdit.id}`
      : '/api/accounts';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.data), // Send validated data
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Assuming errorData.error can be an array of objects with path and message (like Zod issues)
        const message = Array.isArray(errorData.error)
          ? errorData.error.map((e: { path: (string|number)[]; message: string; }) => `${e.path.join('.')}: ${e.message}`).join('; ')
          : (errorData.error?.message || errorData.error || 'Failed to save account');
        throw new Error(message);
      }

      onSave();
      onClose();
    } catch (err: unknown) { // Changed to unknown
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

  const getError = (field: keyof AccountFormData) => {
    return errors?.errors.find(e => e.path.includes(field))?.message;
  }

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
        <DialogHeader>
          <DialogTitle>
            {accountToEdit ? 'Edit Financial Account' : 'Add New Financial Account'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3 py-4 max-h-[75vh] overflow-y-auto pr-2 sm:pr-4">
          {serverError && <p className="text-sm text-red-500 bg-red-100 dark:bg-red-900/30 dark:text-red-200 p-3 rounded-md">{serverError}</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label htmlFor="nickname">Nickname</Label><Input id="nickname" name="nickname" value={formData.nickname || ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('nickname') && <p className="text-xs text-red-500 mt-1">{getError('nickname')}</p>}</div>
            <div>
              <Label htmlFor="accountType">Account Type</Label>
              <Select name="accountType" value={formData.accountType || ''} onValueChange={(value) => handleSelectChange('accountType', value)} disabled={isSubmitting}>
                <SelectTrigger id="accountType" className="dark:bg-gray-700 dark:border-gray-600"><SelectValue placeholder="Select type..." /></SelectTrigger>
                <SelectContent className="dark:bg-gray-900 border-gray-700">{Object.values(AccountType).map(type => <SelectItem key={type} value={type} className="dark:focus:bg-gray-700">{type.charAt(0) + type.slice(1).toLowerCase().replace('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
              {getError('accountType') && <p className="text-xs text-red-500 mt-1">{getError('accountType')}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label htmlFor="currency">Currency (e.g. USD)</Label><Input id="currency" name="currency" value={formData.currency || ''} onChange={handleChange} disabled={isSubmitting} maxLength={10} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('currency') && <p className="text-xs text-red-500 mt-1">{getError('currency')}</p>}</div>
            <div>
                <Label htmlFor="assetCategoryId">Asset Category (Optional)</Label>
                <Select name="assetCategoryId" value={formData.assetCategoryId || 'none'} onValueChange={(value) => handleSelectChange('assetCategoryId', value)} disabled={isSubmitting}>
                    <SelectTrigger id="assetCategoryId" className="dark:bg-gray-700 dark:border-gray-600"><SelectValue placeholder="Select category..." /></SelectTrigger>
                    <SelectContent className="dark:bg-gray-900 border-gray-700">
                        <SelectItem value="none" className="dark:focus:bg-gray-700">None</SelectItem>
                        {assetCategories.map(cat => <SelectItem key={cat.id} value={cat.id} className="dark:focus:bg-gray-700">{cat.name} ({cat.type})</SelectItem>)}
                    </SelectContent>
                </Select>
                {getError('assetCategoryId') && <p className="text-xs text-red-500 mt-1">{getError('assetCategoryId')}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label htmlFor="bankName">Bank Name (Optional)</Label><Input id="bankName" name="bankName" value={formData.bankName || ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('bankName') && <p className="text-xs text-red-500 mt-1">{getError('bankName')}</p>}</div>
            <div><Label htmlFor="branch">Branch (Optional)</Label><Input id="branch" name="branch" value={formData.branch || ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('branch') && <p className="text-xs text-red-500 mt-1">{getError('branch')}</p>}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label htmlFor="accountNumberEncrypted">Account Number (Optional)</Label><Input id="accountNumberEncrypted" name="accountNumberEncrypted" value={formData.accountNumberEncrypted || ''} onChange={handleChange} disabled={isSubmitting} placeholder="Stored as text for now" className="dark:bg-gray-700 dark:border-gray-600"/>{getError('accountNumberEncrypted') && <p className="text-xs text-red-500 mt-1">{getError('accountNumberEncrypted')}</p>}</div>
            <div><Label htmlFor="ifscSwift">IFSC/SWIFT (Optional)</Label><Input id="ifscSwift" name="ifscSwift" value={formData.ifscSwift || ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>{getError('ifscSwift') && <p className="text-xs text-red-500 mt-1">{getError('ifscSwift')}</p>}</div>
          </div>

          <div>
            <Label htmlFor="linkedAddressId">Linked Address (Optional)</Label>
            <Select name="linkedAddressId" value={formData.linkedAddressId || 'none'} onValueChange={(value) => handleSelectChange('linkedAddressId', value)} disabled={isSubmitting}>
                <SelectTrigger id="linkedAddressId" className="dark:bg-gray-700 dark:border-gray-600"><SelectValue placeholder="Select address..." /></SelectTrigger>
                <SelectContent className="dark:bg-gray-900 border-gray-700">
                    <SelectItem value="none" className="dark:focus:bg-gray-700">None</SelectItem>
                    {userAddresses.map(addr => <SelectItem key={addr.id} value={addr.id} className="dark:focus:bg-gray-700">{addr.line1}, {addr.city} ({addr.type})</SelectItem>)}
                </SelectContent>
            </Select>
            {getError('linkedAddressId') && <p className="text-xs text-red-500 mt-1">{getError('linkedAddressId')}</p>}
          </div>

          <div><Label htmlFor="linkedPhoneNumber">Linked Phone (Optional)</Label><Input id="linkedPhoneNumber" name="linkedPhoneNumber" value={formData.linkedPhoneNumber || ''} onChange={handleChange} disabled={isSubmitting} type="tel" className="dark:bg-gray-700 dark:border-gray-600"/>{getError('linkedPhoneNumber') && <p className="text-xs text-red-500 mt-1">{getError('linkedPhoneNumber')}</p>}</div>

          <h3 className="text-lg font-semibold pt-3 border-t mt-5 dark:text-gray-200 dark:border-gray-700">Online Banking (Optional)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label htmlFor="onlineLoginUsernameEncrypted">Username</Label><Input id="onlineLoginUsernameEncrypted" name="onlineLoginUsernameEncrypted" value={formData.onlineLoginUsernameEncrypted || ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/></div>
            <div><Label htmlFor="onlineLoginPasswordEncrypted">Password Hint</Label><Input id="onlineLoginPasswordEncrypted" name="onlineLoginPasswordEncrypted" value={formData.onlineLoginPasswordEncrypted || ''} onChange={handleChange} disabled={isSubmitting} placeholder="Password stored as text" className="dark:bg-gray-700 dark:border-gray-600"/></div>
          </div>
          <div><Label htmlFor="twoFactorMethod">2FA Method (Optional)</Label><Input id="twoFactorMethod" name="twoFactorMethod" value={formData.twoFactorMethod || ''} onChange={handleChange} disabled={isSubmitting} placeholder="e.g., TOTP, SMS" className="dark:bg-gray-700 dark:border-gray-600"/></div>

          <div>
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea id="notes" name="notes" value={formData.notes || ''} onChange={handleChange} disabled={isSubmitting} className="min-h-[80px] dark:bg-gray-700 dark:border-gray-600" />
            {getError('notes') && <p className="text-xs text-red-500 mt-1">{getError('notes')}</p>}
          </div>

          <DialogFooter className="pt-5">
            <DialogClose asChild><Button type="button" variant="outline" onClick={onClose} className="dark:border-gray-600 hover:dark:bg-gray-700">Cancel</Button></DialogClose>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">{isSubmitting ? (accountToEdit ? 'Saving...' : 'Adding...') : (accountToEdit ? 'Save Changes' : 'Add Account')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
