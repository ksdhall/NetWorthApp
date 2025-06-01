// src/components/mutual-funds/MutualFundManager.tsx
'use client';

import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2, TrendingUp, Briefcase } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MutualFund, AssetCategory, Account as FinancialAccount, AccountType, AssetType } from '@prisma/client'; // Added AssetType
import MutualFundForm from './MutualFundForm'; // Import the actual form

interface FetchedMutualFund extends MutualFund {
  assetCategory?: Pick<AssetCategory, 'id' | 'name' | 'type'> | null;
  linkedAccount?: Pick<FinancialAccount, 'id' | 'nickname' | 'accountType' | 'bankName'> | null;
}

// Types for dropdown data passed to the form
type FormAssetCategory = Pick<AssetCategory, 'id' | 'name' | 'type'>;
type FormUserAccount = Pick<FinancialAccount, 'id' | 'nickname' | 'accountType' | 'bankName'>;


export default function MutualFundManager() {
  const [mutualFunds, setMutualFunds] = useState<FetchedMutualFund[]>([]);
  const [assetCategories, setAssetCategories] = useState<FormAssetCategory[]>([]);
  const [userAccounts, setUserAccounts] = useState<FormUserAccount[]>([]);

  const [isLoading, setIsLoading] = useState(true); // For main fund list
  const [isInitialDataLoading, setIsInitialDataLoading] = useState(true); // For categories and accounts for form
  const [error, setError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [fundToEdit, setFundToEdit] = useState<FetchedMutualFund | null>(null);

  const fetchInitialData = async () => {
    setIsInitialDataLoading(true);
    setError(null);
    try {
      const [mfRes, catRes, accRes] = await Promise.all([
        fetch('/api/mutual-funds'), // API includes related data
        fetch('/api/asset-categories'), // API includes parent/sub
        fetch('/api/accounts') // API includes relations
      ]);

      const getErrorText = async (res: Response, type: string) => {
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: `Failed to parse error for ${type}` }));
          return errorData.error?.message || errorData.error || `Failed to fetch ${type}`;
        }
        return null;
      };

      const mfError = await getErrorText(mfRes, 'mutual funds');
      const catError = await getErrorText(catRes, 'asset categories');
      const accError = await getErrorText(accRes, 'user accounts');

      const errors = [mfError, catError, accError].filter(Boolean).join('; ');
      if (errors) {
        throw new Error(errors);
      }

      setMutualFunds(await mfRes.json());
      setAssetCategories(await catRes.json());
      setUserAccounts(await accRes.json());
      setError(null);

    } catch (err: any) {
      setError(err.message);
      console.error("Fetch initial data error:", err);
    } finally {
      setIsInitialDataLoading(false);
      setIsLoading(false);
    }
  };

  const fetchMutualFundsOnly = async () => {
    setIsLoading(true);
    // setError(null); // Keep general error, only update if this fetch fails
    try {
      const response = await fetch('/api/mutual-funds');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || errorData.error || 'Failed to fetch mutual funds');
      }
      setMutualFunds(await response.json());
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const handleOpenFormForNew = () => { setFundToEdit(null); setIsFormOpen(true); };
  const handleOpenFormForEdit = (fund: FetchedMutualFund) => { setFundToEdit(fund); setIsFormOpen(true); };
  const handleCloseForm = () => { setIsFormOpen(false); setFundToEdit(null); };
  const handleSaveSuccess = () => {
    fetchMutualFundsOnly();
    // Form calls onClose via Dialog logic
  };

  const handleDelete = async (fundId: string) => {
    if (!confirm("Are you sure you want to delete this mutual fund record?")) return;
    setError(null);
    try {
      const response = await fetch(`/api/mutual-funds/${fundId}`, { method: 'DELETE' });
      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData.error || 'Failed to delete mutual fund');
      fetchMutualFundsOnly();
      alert(responseData.message || "Mutual fund deleted successfully.");
    } catch (err: any) {
      setError(err.message);
      // alert("Error deleting mutual fund: " + err.message); // Error is displayed above table
    }
  };

  const formatCurrencyValue = (amount: number | string | null | undefined, currencyCode: string = "USD") => {
    const numericAmount = typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '')) : amount;
    if (numericAmount === null || numericAmount === undefined || isNaN(numericAmount)) return 'N/A';
    try {
        return numericAmount.toLocaleString(undefined, { style: 'currency', currency: currencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch (e) {
        console.warn("Currency formatting failed for code:", currencyCode, e);
        return `${currencyCode} ${numericAmount.toFixed(2)}`;
    }
  };
  const calculateTotalValue = (fund: FetchedMutualFund) => {
    if (fund.unitsHeld && fund.currentNAV) return Number(fund.unitsHeld) * Number(fund.currentNAV); return null;
  };


  if (isInitialDataLoading) return <div className="text-center py-10 dark:text-gray-300">Loading initial data...</div>;

  if (error && mutualFunds.length === 0 && assetCategories.length === 0 && userAccounts.length === 0) {
    return <div className="text-center py-10 text-red-500 dark:text-red-400">Error loading essential data: {error} <Button onClick={fetchInitialData} variant="outline" className="ml-2">Try Again</Button></div>;
  }

  return (
    <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg p-4 sm:p-6 md:p-8">
      {error && !isLoading && <p className="text-sm text-red-500 bg-red-100 dark:bg-red-900/30 dark:text-red-400 p-3 rounded-md mb-4">Last operation error: {error}</p>}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-3 sm:gap-4">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Your Mutual Funds</h2>
        <Button onClick={handleOpenFormForNew} className="flex items-center gap-2 w-full sm:w-auto bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white">
          <PlusCircle size={20} /> Add Mutual Fund
        </Button>
      </div>

      {isLoading && mutualFunds.length === 0 ? <div className="text-center py-10 dark:text-gray-300">Loading mutual funds...</div> :
       !isLoading && mutualFunds.length === 0 && !error ? (
        <p className="text-gray-500 dark:text-gray-400 py-5 text-center">No mutual funds added yet. Click "Add Mutual Fund".</p>
      ) : mutualFunds.length > 0 ? (
        <div className="overflow-x-auto rounded-md border dark:border-gray-700">
          <Table>
            <TableHeader className="bg-gray-50 dark:bg-gray-800">
              <TableRow>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Fund Name</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Units</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg. Cost</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">NAV</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Value</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Demat A/C</TableHead>
                <TableHead className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {mutualFunds.map((fund) => {
                const totalValue = calculateTotalValue(fund);
                return (
                  <TableRow key={fund.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{fund.fundName}</TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{Number(fund.unitsHeld).toLocaleString(undefined, {maximumFractionDigits: 4})}</TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{formatCurrencyValue(Number(fund.averageCostPerUnit), fund.currency)}</TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{formatCurrencyValue(fund.currentNAV, fund.currency)}</TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-gray-100">{formatCurrencyValue(totalValue, fund.currency)}</TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{fund.assetCategory?.name || <span className="text-gray-400 dark:text-gray-500">N/A</span>}</TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{fund.linkedAccount?.nickname || <span className="text-gray-400 dark:text-gray-500">N/A</span>}</TableCell>
                    <TableCell className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <Button variant="outline" size="icon" onClick={() => handleOpenFormForEdit(fund)} title="Edit" className="dark:text-gray-300 dark:border-gray-600 hover:dark:bg-gray-700 w-8 h-8"><Edit size={16} /></Button>
                      <Button variant="destructive" size="icon" onClick={() => handleDelete(fund.id)} title="Delete" className="w-8 h-8"><Trash2 size={16} /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {!isInitialDataLoading && (
        <MutualFundForm
          fundToEdit={fundToEdit}
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
