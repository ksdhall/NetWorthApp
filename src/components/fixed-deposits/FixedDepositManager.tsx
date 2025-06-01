// src/components/fixed-deposits/FixedDepositManager.tsx
'use client';

import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2, Landmark } from "lucide-react"; // Removed CalendarDays, TrendingUp as they are not directly used for icons here
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge"; // Not used in current table display, but kept for potential future use
import { FixedDeposit, AssetCategory, Account as FinancialAccount, PayoutFrequency, AccountType, AssetType } from '@prisma/client'; // Added AccountType, AssetType
import FixedDepositForm from './FixedDepositForm'; // Import the actual form

interface FetchedFixedDeposit extends FixedDeposit {
  assetCategory?: Pick<AssetCategory, 'id' | 'name' | 'type'> | null;
  linkedAccount?: Pick<FinancialAccount, 'id' | 'nickname' | 'accountType' | 'bankName'> | null;
}

// Types for dropdown data passed to the form
type FormAssetCategory = Pick<AssetCategory, 'id' | 'name' | 'type'>;
type FormUserAccount = Pick<FinancialAccount, 'id' | 'nickname' | 'accountType' | 'bankName'>;


// Helper function to calculate simple interest maturity value
const calculateMaturityValue = (principal: number, rate: number, startDate: Date, maturityDate: Date): number => {
  if (isNaN(principal) || isNaN(rate) || !(startDate instanceof Date) || !(maturityDate instanceof Date) || startDate >= maturityDate) {
    return principal;
  }
  const durationInMilliseconds = maturityDate.getTime() - startDate.getTime();
  if (durationInMilliseconds <= 0) return principal;
  const durationInYears = durationInMilliseconds / (1000 * 60 * 60 * 24 * 365.25);
  const maturityAmount = principal * (1 + (rate / 100) * durationInYears);
  return maturityAmount;
};

export default function FixedDepositManager() {
  const [fixedDeposits, setFixedDeposits] = useState<FetchedFixedDeposit[]>([]);
  const [assetCategories, setAssetCategories] = useState<FormAssetCategory[]>([]);
  const [userAccounts, setUserAccounts] = useState<FormUserAccount[]>([]);

  const [isLoading, setIsLoading] = useState(true); // For main FD list
  const [isInitialDataLoading, setIsInitialDataLoading] = useState(true); // For categories and accounts for form
  const [error, setError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [fdToEdit, setFdToEdit] = useState<FetchedFixedDeposit | null>(null);

  const fetchInitialData = async () => {
    setIsInitialDataLoading(true);
    setError(null);
    try {
      const [fdRes, catRes, accRes] = await Promise.all([
        fetch('/api/fixed-deposits'),
        fetch('/api/asset-categories'),
        fetch('/api/accounts')
      ]);

      const getErrorText = async (res: Response, type: string) => {
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: `Failed to parse error for ${type}` }));
          return errorData.error?.message || errorData.error || `Failed to fetch ${type}`;
        }
        return null;
      };

      const fdError = await getErrorText(fdRes, 'fixed deposits');
      const catError = await getErrorText(catRes, 'asset categories');
      const accError = await getErrorText(accRes, 'user accounts');

      const errors = [fdError, catError, accError].filter(Boolean).join('; ');
      if (errors) {
        throw new Error(errors);
      }

      setFixedDeposits(await fdRes.json());
      setAssetCategories(await catRes.json());
      setUserAccounts(await accRes.json());
      setError(null);

    } catch (err: any) {
      setError(err.message);
      console.error("Fetch initial data error:", err);
    }
    finally {
      setIsInitialDataLoading(false);
      setIsLoading(false); // Main list loading also depends on this initial fetch
    }
  };

  const fetchFixedDepositsOnly = async () => {
    setIsLoading(true);
    // setError(null); // Keep general error, only update if this fetch fails
    try {
      const response = await fetch('/api/fixed-deposits');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || errorData.error || 'Failed to fetch FDs');
      }
      setFixedDeposits(await response.json());
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
    finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchInitialData(); }, []);

  const handleOpenFormForNew = () => { setFdToEdit(null); setIsFormOpen(true); };
  const handleOpenFormForEdit = (fd: FetchedFixedDeposit) => { setFdToEdit(fd); setIsFormOpen(true); };
  const handleCloseForm = () => { setIsFormOpen(false); setFdToEdit(null); };
  const handleSaveSuccess = () => {
    fetchFixedDepositsOnly();
    // Form calls onClose via Dialog logic
  };

  const handleDelete = async (fdId: string) => {
    if (!confirm("Are you sure you want to delete this fixed deposit record?")) return;
    setError(null);
    try {
      const response = await fetch(`/api/fixed-deposits/${fdId}`, { method: 'DELETE' });
      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData.error || 'Failed to delete FD');
      fetchFixedDepositsOnly();
      alert(responseData.message || "Fixed deposit deleted successfully.");
    } catch (err: any) {
      setError(err.message);
      // alert("Error deleting FD: " + err.message); // Error displayed above table
    }
  };

  const formatCurrencyDisplay = (amount: number | string | null | undefined, currencyCode: string = "USD") => {
    const numericAmount = typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '')) : amount;
    if (numericAmount === null || numericAmount === undefined || isNaN(numericAmount)) return 'N/A';
    try {
      return numericAmount.toLocaleString(undefined, {style:'currency', currency:currencyCode, minimumFractionDigits:2, maximumFractionDigits:2});
    } catch(e) {
      console.warn("Currency formatting failed for code:", currencyCode, e);
      return `${currencyCode} ${numericAmount.toFixed(2)}`;
    }
  };


  if (isInitialDataLoading) return <div className="text-center py-10 dark:text-gray-300">Loading initial data...</div>;

  if (error && fixedDeposits.length === 0 && assetCategories.length === 0 && userAccounts.length === 0) {
    return <div className="text-center py-10 text-red-500 dark:text-red-400">Error loading essential data: {error} <Button onClick={fetchInitialData} variant="outline" className="ml-2">Try Again</Button></div>;
  }

  return (
    <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg p-4 sm:p-6 md:p-8">
      {error && !isLoading && <p className="text-sm text-red-500 bg-red-100 dark:bg-red-900/30 dark:text-red-400 p-3 rounded-md mb-4">Last operation error: {error}</p>}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-3 sm:gap-4">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Your Fixed Deposits</h2>
        <Button onClick={handleOpenFormForNew} className="flex items-center gap-2 w-full sm:w-auto bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white">
          <PlusCircle size={20} /> Add Fixed Deposit
        </Button>
      </div>

      {isLoading && fixedDeposits.length === 0 ? <div className="text-center py-10 dark:text-gray-300">Loading FDs...</div> :
       !isLoading && fixedDeposits.length === 0 && !error ? (
        <p className="text-gray-500 dark:text-gray-400 py-5 text-center">No fixed deposits added yet. Click "Add Fixed Deposit".</p>
      ) : fixedDeposits.length > 0 ? (
        <div className="overflow-x-auto rounded-md border dark:border-gray-700">
          <Table>
            <TableHeader className="bg-gray-50 dark:bg-gray-800">
              <TableRow>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Bank</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Principal</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Rate</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Start</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Maturity</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Maturity Value</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Payout</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</TableHead>
                <TableHead className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {fixedDeposits.map((fd) => {
                const principal = Number(fd.principalAmount);
                const rate = Number(fd.interestRate);
                const startDate = new Date(fd.startDate);
                const maturityDate = new Date(fd.maturityDate);
                const maturityValue = calculateMaturityValue(principal, rate, startDate, maturityDate);
                return (
                  <TableRow key={fd.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center"><Landmark size={16} className="mr-2 opacity-70"/>{fd.bankName}</TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{formatCurrencyDisplay(principal, fd.currency)}</TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{rate.toFixed(2)}%</TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{startDate.toLocaleDateString()}</TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{maturityDate.toLocaleDateString()}</TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-gray-100">{formatCurrencyDisplay(maturityValue, fd.currency)}</TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{fd.payoutFrequency.charAt(0) + fd.payoutFrequency.slice(1).toLowerCase().replace(/_/g, ' ')}</TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{fd.assetCategory?.name || <span className="text-gray-400 dark:text-gray-500">N/A</span>}</TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <Button variant="outline" size="icon" onClick={() => handleOpenFormForEdit(fd)} title="Edit" className="dark:text-gray-300 dark:border-gray-600 hover:dark:bg-gray-700 w-8 h-8"><Edit size={16} /></Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDelete(fd.id)} title="Delete" className="w-8 h-8"><Trash2 size={16} /></Button>
                    </TableCell>
                  </TableRow>
                );})}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {!isInitialDataLoading && (
        <FixedDepositForm
          fdToEdit={fdToEdit}
          assetCategories={assetCategories}
          userAccounts={userAccounts}
          isOpen={isFormOpen}
          onClose={handleCloseForm}
          onSave={handleSaveSuccess}
        />
      )}
    </div>
  );
}
