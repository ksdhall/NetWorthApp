// src/components/accounts/AccountManager.tsx
'use client';

import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2, Landmark, Wallet } from "lucide-react"; // Removed CreditCard, not used for AccountType icons
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Account, AccountType, AssetCategory, AddressHistory } from '@prisma/client';
import AccountForm from './AccountForm'; // Import the actual form

// Enhance Account type for potential includes from API
interface FetchedAccount extends Account {
  assetCategory?: Pick<AssetCategory, 'id' | 'name' | 'type'> | null;
  linkedAddress?: Pick<AddressHistory, 'id' | 'line1' | 'city' | 'type'> | null;
}

// Types for dropdown data
type SelectableAssetCategory = Pick<AssetCategory, 'id' | 'name' | 'type'>;
type SelectableUserAddress = Pick<AddressHistory, 'id' | 'line1' | 'city' | 'type'>;

export default function AccountManager() {
  const [accounts, setAccounts] = useState<FetchedAccount[]>([]);
  const [assetCategories, setAssetCategories] = useState<SelectableAssetCategory[]>([]);
  const [userAddresses, setUserAddresses] = useState<SelectableUserAddress[]>([]);

  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true); // For main accounts list
  const [isLoadingInitialData, setIsLoadingInitialData] = useState(true); // For categories and addresses
  const [error, setError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<FetchedAccount | null>(null);

  const fetchInitialData = async () => {
    setIsLoadingInitialData(true);
    setError(null);
    try {
      // Fetch accounts, asset categories, and user addresses concurrently
      // The API for accounts now includes assetCategory and linkedAddress by default from previous step.
      const [accResponse, catResponse, addrResponse] = await Promise.all([
        fetch('/api/accounts'),
        fetch('/api/asset-categories'), // This API needs to be created
        fetch('/api/addresses')         // This API exists
      ]);

      if (!accResponse.ok) throw new Error(`Accounts: ${(await accResponse.json()).error?.message || (await accResponse.json()).error || 'Failed to fetch'}`);
      if (!catResponse.ok) throw new Error(`Categories: ${(await catResponse.json()).error?.message || (await catResponse.json()).error || 'Failed to fetch'}`);
      if (!addrResponse.ok) throw new Error(`Addresses: ${(await addrResponse.json()).error?.message || (await addrResponse.json()).error || 'Failed to fetch'}`);

      setAccounts(await accResponse.json());
      setAssetCategories(await catResponse.json());
      setUserAddresses(await addrResponse.json());
      setError(null); // Clear error on successful fetch of all data

    } catch (err: any) {
      setError(err.message);
      console.error("Initial data fetch error:", err);
    } finally {
      setIsLoadingAccounts(false); // Accounts are part of initial data
      setIsLoadingInitialData(false);
    }
  };

  const fetchAccountsOnly = async () => {
    setIsLoadingAccounts(true);
    // setError(null); // Keep previous general errors unless this specific fetch fails
    try {
      const response = await fetch('/api/accounts');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || errorData.error || 'Failed to fetch accounts');
      }
      setAccounts(await response.json());
      setError(null); // Clear error only if this specific fetch is successful
    } catch (err: any) {
      setError(err.message); // Set error for this specific operation
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const handleOpenFormForNew = () => {
    setAccountToEdit(null);
    setIsFormOpen(true);
  };

  const handleOpenFormForEdit = (account: FetchedAccount) => {
    setAccountToEdit(account);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setAccountToEdit(null);
  };

  const handleSaveSuccess = () => {
    fetchAccountsOnly();
  };

  const handleDelete = async (accountId: string) => {
    if (!confirm("Are you sure you want to delete this account? This may also affect related records like balances and transactions.")) return;

    setError(null);
    try {
      const response = await fetch(`/api/accounts/${accountId}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || errorData.error || 'Failed to delete account');
      }
      fetchAccountsOnly();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getAccountTypeIcon = (type: AccountType) => {
    switch (type) {
      case AccountType.SAVINGS: case AccountType.CHECKING: case AccountType.DEMAT: case AccountType.NRI:
        return <Landmark size={18} className="mr-2 text-blue-500 dark:text-blue-400" />;
      case AccountType.LIABILITY: return <Wallet size={18} className="mr-2 text-red-500 dark:text-red-400" />;
      default: return <Wallet size={18} className="mr-2 text-gray-500 dark:text-gray-400" />;
    }
  };

  if (isLoadingInitialData) return <div className="text-center py-10 dark:text-gray-300">Loading initial data...</div>;

  // If initial data load failed for any crucial part (e.g. categories/addresses needed for form)
  // This check might need refinement based on what's critical for the page to render vs the form.
  if (error && (assetCategories.length === 0 || userAddresses.length === 0) && !isFormOpen) {
    return <div className="text-center py-10 text-red-500 dark:text-red-400">Error loading essential data: {error} <Button onClick={fetchInitialData} variant="outline" className="ml-2">Try Again</Button></div>;
  }

  return (
    <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg p-4 sm:p-6 md:p-8">
      {/* Display general/last operation error, but not if it's just for account list loading and form is open */}
      {error && !isLoadingAccounts && <p className="text-sm text-red-500 bg-red-100 dark:bg-red-900/30 dark:text-red-400 p-3 rounded-md mb-4">Last operation error: {error}</p>}

      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-3 sm:gap-4">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Your Financial Accounts</h2>
        <Button onClick={handleOpenFormForNew} className="flex items-center gap-2 w-full sm:w-auto bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white">
          <PlusCircle size={20} /> Add New Account
        </Button>
      </div>

      {isLoadingAccounts && accounts.length === 0 ? <div className="text-center py-10 dark:text-gray-300">Loading accounts...</div> :
       !isLoadingAccounts && accounts.length === 0 && !error ? ( // Show only if no error and not loading
        <p className="text-gray-500 dark:text-gray-400 py-5 text-center">No financial accounts yet. Click "Add New Account".</p>
      ) : accounts.length > 0 ? ( // Only show table if there are accounts
        <div className="overflow-x-auto rounded-md border dark:border-gray-700">
          <Table>
            <TableHeader className="bg-gray-50 dark:bg-gray-800">
              <TableRow>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nickname</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Bank</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Currency</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</TableHead>
                <TableHead className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {accounts.map((acc) => (
                <TableRow key={acc.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{acc.nickname}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 flex items-center">
                    {getAccountTypeIcon(acc.accountType)}
                    {acc.accountType.charAt(0) + acc.accountType.slice(1).toLowerCase().replace('_', ' ')}
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{acc.bankName || 'N/A'}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm"><Badge variant="secondary" className="dark:bg-gray-700 dark:text-gray-300">{acc.currency}</Badge></TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{acc.assetCategory?.name || 'N/A'}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <Button variant="outline" size="icon" onClick={() => handleOpenFormForEdit(acc)} title="Edit" className="dark:text-gray-300 dark:border-gray-600 hover:dark:bg-gray-700 w-8 h-8"><Edit size={16} /></Button>
                    <Button variant="destructive" size="icon" onClick={() => handleDelete(acc.id)} title="Delete" className="w-8 h-8"><Trash2 size={16} /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null} {/* If accounts list is empty due to an error, the error message above is shown */}

      {!isLoadingInitialData && ( // Don't render form until categories and addresses are loaded (or failed)
        <AccountForm
          accountToEdit={accountToEdit}
          assetCategories={assetCategories}
          userAddresses={userAddresses}
          isOpen={isFormOpen}
          onClose={handleCloseForm}
          onSave={handleSaveSuccess}
        />
      )}
    </div>
  );
}
