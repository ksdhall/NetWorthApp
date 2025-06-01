// src/components/balances/BalanceManager.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2, CalendarIcon, Eye, EyeOff, ChevronDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
// import { Badge } from "@/components/ui/badge"; // Not currently used
import { Account as FinancialAccount, BalanceEntry } from '@prisma/client';
import BalanceEntryForm from './BalanceEntryForm'; // Import the actual form

interface FetchedBalanceEntry extends BalanceEntry {
  account?: Pick<FinancialAccount, 'id' | 'nickname' | 'currency'>;
}

export default function BalanceManager() {
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [balanceEntries, setBalanceEntries] = useState<FetchedBalanceEntry[]>([]);

  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [entryToEdit, setEntryToEdit] = useState<FetchedBalanceEntry | null>(null);
  const [targetDateForNewEntry, setTargetDateForNewEntry] = useState<Date>(() => {
    const today = new Date();
    return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)); // Default to 1st of current month UTC
  });

  useEffect(() => {
    const fetchAccounts = async () => {
      setIsLoadingAccounts(true);
      setError(null);
      try {
        const response = await fetch('/api/accounts');
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || errorData.error || 'Failed to fetch accounts');
        }
        const data: FinancialAccount[] = await response.json();
        setAccounts(data);
        if (data.length > 0 && !selectedAccountId) {
          setSelectedAccountId(data[0].id);
        } else if (data.length === 0) {
            setSelectedAccountId("");
            setBalanceEntries([]);
        }
      } catch (err: any) {
        setError(err.message);
        console.error("Fetch accounts error:", err);
      } finally {
        setIsLoadingAccounts(false);
      }
    };
    fetchAccounts();
  }, []);

  const fetchEntriesForAccount = async (accountId: string) => {
    if (!accountId) {
        setBalanceEntries([]);
        setIsLoadingEntries(false); // Ensure loading is false if no accountId
        return;
    }
    setIsLoadingEntries(true);
    // setError(null); // Clear only entry-specific errors, keep general account load errors if any
    try {
      const response = await fetch(`/api/balance-entries?accountId=${accountId}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || errorData.error || 'Failed to fetch balance entries');
      }
      setBalanceEntries(await response.json());
      setError(null); // Clear error on successful fetch of entries
    } catch (err:any) {
      setError(err.message);
      setBalanceEntries([]);
      console.error("Fetch entries error:", err);
    }
    finally { setIsLoadingEntries(false); }
  }

  useEffect(() => {
    fetchEntriesForAccount(selectedAccountId);
  }, [selectedAccountId]);

  const selectedAccount = useMemo(() => accounts.find(acc => acc.id === selectedAccountId), [accounts, selectedAccountId]);

  const handleOpenFormForNew = (date?: Date) => {
    const today = new Date();
    // Set to first of current month UTC for consistency with how dates are stored/compared
    setTargetDateForNewEntry(date || new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));
    setEntryToEdit(null);
    setIsFormOpen(true);
  };

  const handleOpenFormForEdit = (entry: FetchedBalanceEntry) => { setEntryToEdit(entry); setIsFormOpen(true); };
  const handleCloseForm = () => { setIsFormOpen(false); setEntryToEdit(null); };
  const handleSaveSuccess = () => {
    if (selectedAccountId) fetchEntriesForAccount(selectedAccountId);
    // Form calls onClose via Dialog logic
  };

  const handleDelete = async (entryId: string) => {
    if (!confirm("Are you sure you want to delete this balance entry?")) return;
    setError(null);
    try {
      const response = await fetch(`/api/balance-entries/${entryId}`, { method: 'DELETE' });
      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData.error?.message || responseData.error || 'Failed to delete balance entry');
      if (selectedAccountId) fetchEntriesForAccount(selectedAccountId);
      alert(responseData.message || "Balance entry deleted successfully.");
    } catch (err: any) {
      setError(err.message);
      // alert("Error deleting balance entry: " + err.message); // Error shown above table
    }
  };

  const formatCurrencyDisplay = (amount: number | string | null | undefined, currencyCode: string = "USD") => {
    const numericAmount = typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '')) : amount;
    if (numericAmount === null || numericAmount === undefined || isNaN(numericAmount)) return <span className="text-gray-400 dark:text-gray-500">N/A</span>;
    try {
        return numericAmount.toLocaleString(undefined, { style: 'currency', currency: currencyCode, minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch (e) {
        console.warn("Currency formatting failed for code:", currencyCode, e);
        return `${currencyCode} ${numericAmount.toFixed(2)}`;
    }
  };

  if (isLoadingAccounts) return <div className="text-center py-10 dark:text-gray-300">Loading accounts...</div>;

  if (error && accounts.length === 0) { // If account loading failed completely
    return <div className="text-center py-10 text-red-500 dark:text-red-400">Error loading accounts: {error} <Button onClick={() => {setSelectedAccountId(""); fetchAccounts();}} variant="outline" className="ml-2">Try Again</Button></div>;
  }

  return (
    <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg p-4 sm:p-6 md:p-8">
      <div className="mb-6">
        <Label htmlFor="account-select" className="text-lg font-semibold text-gray-800 dark:text-gray-100 block mb-2">Select Account:</Label>
        {accounts.length > 0 ? (
          <Select value={selectedAccountId || ""} onValueChange={setSelectedAccountId}>
            <SelectTrigger id="account-select" className="w-full md:w-1/2 lg:w-1/3 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-50">
              <SelectValue placeholder="Choose an account..." />
            </SelectTrigger>
            <SelectContent className="dark:bg-gray-800 dark:border-gray-700 dark:text-gray-50">
              {accounts.map(acc => (
                <SelectItem key={acc.id} value={acc.id} className="dark:focus:bg-gray-700">{acc.nickname} ({acc.bankName || 'N/A'} - {acc.currency})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">No accounts found. Please add an account first on the Accounts page.</p>
        )}
      </div>

      {selectedAccountId && ( <>
          {/* Display entry-specific errors or general errors if accounts loaded but entries failed */}
          {error && !isLoadingEntries && <p className="text-sm text-red-500 bg-red-100 dark:bg-red-900/30 dark:text-red-400 p-3 rounded-md mb-4">Error: {error}</p>}
          <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-3 sm:gap-4">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Balance History for {selectedAccount?.nickname}</h2>
            <Button onClick={() => handleOpenFormForNew()} className="flex items-center gap-2 w-full sm:w-auto bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white">
              <PlusCircle size={20} /> Add Balance Entry
            </Button>
          </div>
          {isLoadingEntries ? <div className="text-center py-10 dark:text-gray-300">Loading balance entries...</div> :
           !isLoadingEntries && balanceEntries.length === 0 && !error ? ( // Show only if no error and not loading
            <p className="text-gray-500 dark:text-gray-400 py-5 text-center">No balance entries found for this account.</p>
          ) : balanceEntries.length > 0 ? (
            <div className="overflow-x-auto rounded-md border dark:border-gray-700">
              <Table>
                <TableHeader className="bg-gray-50 dark:bg-gray-800">
                    <TableRow>
                    <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Entry Date</TableHead>
                    <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Original Balance</TableHead>
                    <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Exch. Rate</TableHead>
                    <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Base Balance (Est.)</TableHead>
                    <TableHead className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Locked</TableHead>
                    <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Notes</TableHead>
                    <TableHead className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {balanceEntries.map((entry) => (
                    <TableRow key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{new Date(entry.entryDate).toLocaleDateString('default', { year: 'numeric', month: 'long', timeZone: 'UTC' })}</TableCell>
                      <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{formatCurrencyDisplay(Number(entry.balanceOriginal), entry.currency)}</TableCell>
                      <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{entry.exchangeRateToBase ? Number(entry.exchangeRateToBase).toFixed(4) : <span className="text-gray-400 dark:text-gray-500">N/A</span>}</TableCell>
                      <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-gray-100">{formatCurrencyDisplay(Number(entry.balanceInBase), selectedAccount?.currency)}</TableCell>
                      <TableCell className="px-4 py-3 whitespace-nowrap text-center">{entry.locked ? <EyeOff size={16} className="text-orange-500 dark:text-orange-400 inline-block" title="Locked"/> : <Eye size={16} className="text-green-500 dark:text-green-400 inline-block" title="Editable"/>}</TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-[150px] truncate" title={entry.notes || ''}>{entry.notes || <span className="text-gray-400 dark:text-gray-500">N/A</span>}</TableCell>
                      <TableCell className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <Button variant="outline" size="icon" onClick={() => handleOpenFormForEdit(entry)} title="Edit" className="dark:text-gray-300 dark:border-gray-600 hover:dark:bg-gray-700 w-8 h-8"><Edit size={16} /></Button>
                        <Button variant="destructive" size="icon" onClick={() => handleDelete(entry.id)} title="Delete" className="w-8 h-8"><Trash2 size={16} /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </>
      )}

      {selectedAccount && !isLoadingAccounts && !isLoadingEntries && ( // Ensure selectedAccount is loaded before rendering form
        <BalanceEntryForm
          entryToEdit={entryToEdit}
          selectedAccount={selectedAccount}
          targetDateForNew={targetDateForNewEntry}
          isOpen={isFormOpen}
          onClose={handleCloseForm}
          onSave={handleSaveSuccess}
        />
      )}
    </div>
  );
}
