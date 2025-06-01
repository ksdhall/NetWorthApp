// src/components/credit-cards/CreditCardManager.tsx
'use client';

import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2, CreditCard as CreditCardIcon } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CreditCard, AddressHistory, AssetCategory, CreditCardType, AssetType } from '@prisma/client'; // Added AssetType
import CreditCardForm from './CreditCardForm'; // Import the actual form

interface FetchedCreditCard extends CreditCard {
  billingAddress?: Pick<AddressHistory, 'id' | 'line1' | 'city' | 'country' | 'type'> | null;
  assetCategory?: Pick<AssetCategory, 'id' | 'name' | 'type'> | null;
}

// Types for dropdown data, ensuring only necessary fields are expected by the form
type FormAssetCategory = Pick<AssetCategory, 'id' | 'name' | 'type'>;
type FormUserAddress = Pick<AddressHistory, 'id' | 'line1' | 'city' | 'type'>;


export default function CreditCardManager() {
  const [creditCards, setCreditCards] = useState<FetchedCreditCard[]>([]);
  const [assetCategories, setAssetCategories] = useState<FormAssetCategory[]>([]);
  const [userAddresses, setUserAddresses] = useState<FormUserAddress[]>([]);

  const [isLoading, setIsLoading] = useState(true); // For main card list
  const [isInitialDataLoading, setIsInitialDataLoading] = useState(true); // For categories and addresses
  const [error, setError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [cardToEdit, setCardToEdit] = useState<FetchedCreditCard | null>(null);

  const fetchInitialData = async () => {
    setIsInitialDataLoading(true);
    // setError(null); // Keep error from previous operations if any, until all successful
    try {
      const [cardRes, catRes, addrRes] = await Promise.all([
        fetch('/api/credit-cards'), // API includes related data
        fetch('/api/asset-categories'), // API includes parent/sub categories
        fetch('/api/addresses') // API includes relevant fields
      ]);

      const getErrorText = async (res: Response, type: string) => {
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: `Failed to parse error for ${type}` }));
          return errorData.error?.message || errorData.error || `Failed to fetch ${type}`;
        }
        return null;
      };

      const cardError = await getErrorText(cardRes, 'credit cards');
      const catError = await getErrorText(catRes, 'asset categories');
      const addrError = await getErrorText(addrRes, 'addresses');

      const errors = [cardError, catError, addrError].filter(Boolean).join('; ');
      if (errors) {
        throw new Error(errors);
      }

      setCreditCards(await cardRes.json());
      setAssetCategories(await catRes.json());
      setUserAddresses(await addrRes.json());
      setError(null); // Clear error on successful fetch of all data

    } catch (err: any) {
      setError(err.message);
      console.error("Fetch initial data error:", err);
    } finally {
      setIsInitialDataLoading(false);
      setIsLoading(false); // Main list loading also depends on this initial fetch
    }
  };

  const fetchCreditCardsOnly = async () => {
    setIsLoading(true);
    // setError(null); // Keep general error, only update if this fetch fails
    try {
      const response = await fetch('/api/credit-cards');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || errorData.error || 'Failed to fetch credit cards');
      }
      setCreditCards(await response.json());
      setError(null); // Clear error only if this specific fetch is successful
    } catch (err: any) {
      setError(err.message); // Set error for this specific operation
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const handleOpenFormForNew = () => { setCardToEdit(null); setIsFormOpen(true); };
  const handleOpenFormForEdit = (card: FetchedCreditCard) => { setCardToEdit(card); setIsFormOpen(true); };
  const handleCloseForm = () => { setIsFormOpen(false); setCardToEdit(null); };
  const handleSaveSuccess = () => {
    fetchCreditCardsOnly();
    // Form calls onClose via Dialog logic
  };

  const handleDelete = async (cardId: string) => {
    if (!confirm("Are you sure you want to delete this credit card?")) return;
    setError(null);
    try {
      const response = await fetch(`/api/credit-cards/${cardId}`, { method: 'DELETE' });
      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData.error || 'Failed to delete credit card');
      fetchCreditCardsOnly();
      alert(responseData.message || "Credit card deleted successfully.");
    } catch (err: any) {
      setError(err.message);
      // alert("Error deleting credit card: " + err.message); // Error displayed above table
    }
  };

  const formatCurrency = (amount: number | string | null | undefined) => {
    const numericAmount = typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '')) : amount;
    if (numericAmount === null || numericAmount === undefined || isNaN(numericAmount)) return 'N/A';
    return numericAmount.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:0});
  };

  if (isInitialDataLoading) return <div className="text-center py-10 dark:text-gray-300">Loading initial data...</div>;

  if (error && creditCards.length === 0 && assetCategories.length === 0 && userAddresses.length === 0) {
    return <div className="text-center py-10 text-red-500 dark:text-red-400">Error loading essential data: {error} <Button onClick={fetchInitialData} variant="outline" className="ml-2">Try Again</Button></div>;
  }

  return (
    <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg p-4 sm:p-6 md:p-8">
      {error && !isLoading && <p className="text-sm text-red-500 bg-red-100 dark:bg-red-900/30 dark:text-red-400 p-3 rounded-md mb-4">Last operation error: {error}</p>}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-3 sm:gap-4">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Your Credit Cards</h2>
        <Button onClick={handleOpenFormForNew} className="flex items-center gap-2 w-full sm:w-auto bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white">
          <PlusCircle size={20} /> Add New Credit Card
        </Button>
      </div>

      {isLoading && creditCards.length === 0 ? <div className="text-center py-10 dark:text-gray-300">Loading credit cards...</div> :
       !isLoading && creditCards.length === 0 && !error ? (
        <p className="text-gray-500 dark:text-gray-400 py-5 text-center">No credit cards added yet. Click "Add New Credit Card".</p>
      ) : creditCards.length > 0 ? (
        <div className="overflow-x-auto rounded-md border dark:border-gray-700">
          <Table>
            <TableHeader className="bg-gray-50 dark:bg-gray-800">
              <TableRow>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Nickname</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last 4</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Bank</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Expiry</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Limit</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</TableHead>
                <TableHead className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {creditCards.map((card) => (
                <TableRow key={card.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{card.nickname}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300 flex items-center">
                    <CreditCardIcon size={18} className="mr-2 text-blue-500 dark:text-blue-400" />
                    {card.cardType.charAt(0) + card.cardType.slice(1).toLowerCase().replace('_', ' ')}
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">**** {card.lastFourDigits}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{card.issuingBank}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{new Date(card.expiryDate).toLocaleDateString('en-US', { year: '2-digit', month: '2-digit' })}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{formatCurrency(card.creditLimit)}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{card.assetCategory?.name || <span className="text-gray-400 dark:text-gray-500">N/A</span>}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <Button variant="outline" size="icon" onClick={() => handleOpenFormForEdit(card)} title="Edit" className="dark:text-gray-300 dark:border-gray-600 hover:dark:bg-gray-700 w-8 h-8"><Edit size={16} /></Button>
                    <Button variant="destructive" size="icon" onClick={() => handleDelete(card.id)} title="Delete" className="w-8 h-8"><Trash2 size={16} /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {!isInitialDataLoading && (
        <CreditCardForm
          cardToEdit={cardToEdit}
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
