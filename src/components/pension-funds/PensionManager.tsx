// src/components/pension-funds/PensionManager.tsx
'use client';

import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2, Building, Globe } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge"; // Kept for potential future use
import { PensionProfile, AssetCategory, PensionCountry, AssetType } from '@prisma/client'; // Added AssetType
import PensionForm from './PensionForm'; // Import the actual form

interface FetchedPensionProfile extends PensionProfile {
  assetCategory?: Pick<AssetCategory, 'id' | 'name' | 'type'> | null;
}

// Type for dropdown data passed to the form
type FormAssetCategory = Pick<AssetCategory, 'id' | 'name' | 'type'>;

export default function PensionManager() {
  const [profiles, setProfiles] = useState<FetchedPensionProfile[]>([]);
  const [assetCategories, setAssetCategories] = useState<FormAssetCategory[]>([]);

  const [isLoading, setIsLoading] = useState(true); // For main profile list
  const [isInitialDataLoading, setIsInitialDataLoading] = useState(true); // For categories for form
  const [error, setError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [profileToEdit, setProfileToEdit] = useState<FetchedPensionProfile | null>(null);

  const fetchInitialData = async () => {
    setIsInitialDataLoading(true);
    setError(null);
    try {
      const [profileRes, catRes] = await Promise.all([
        fetch('/api/pension-profiles'),
        fetch('/api/asset-categories') // API includes parent/sub categories if any
      ]);

      const getErrorText = async (res: Response, type: string) => {
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: `Failed to parse error for ${type}` }));
          return errorData.error?.message || errorData.error || `Failed to fetch ${type}`;
        }
        return null;
      };

      const profileError = await getErrorText(profileRes, 'pension profiles');
      const catError = await getErrorText(catRes, 'asset categories');

      const errors = [profileError, catError].filter(Boolean).join('; ');
      if (errors) {
        throw new Error(errors);
      }

      setProfiles(await profileRes.json());
      setAssetCategories(await catRes.json());
      setError(null);

    } catch (err: any) {
      setError(err.message);
      console.error("Fetch initial data error:", err);
    }
    finally {
      setIsInitialDataLoading(false);
      setIsLoading(false);
    }
  };

  const fetchPensionProfilesOnly = async () => {
    setIsLoading(true);
    // setError(null); // Keep general error
    try {
      const response = await fetch('/api/pension-profiles');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || errorData.error || 'Failed to fetch pension profiles');
      }
      setProfiles(await response.json());
      setError(null);
    } catch (err: any) {
      setError(err.message);
    }
    finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchInitialData(); }, []);

  const handleOpenFormForNew = () => { setProfileToEdit(null); setIsFormOpen(true); };
  const handleOpenFormForEdit = (profile: FetchedPensionProfile) => { setProfileToEdit(profile); setIsFormOpen(true); };
  const handleCloseForm = () => { setIsFormOpen(false); setProfileToEdit(null); };
  const handleSaveSuccess = () => {
    fetchPensionProfilesOnly();
    // Form calls onClose via Dialog logic
  };

  const handleDelete = async (profileId: string) => {
    if (!confirm("Are you sure you want to delete this pension profile?")) return;
    setError(null);
    try {
      const response = await fetch(`/api/pension-profiles/${profileId}`, { method: 'DELETE' });
      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData.error || 'Failed to delete pension profile');
      fetchPensionProfilesOnly();
      alert(responseData.message || "Pension profile deleted successfully.");
    } catch (err: any) {
      setError(err.message);
      // alert("Error deleting pension profile: " + err.message); // Error displayed above table
    }
  };

  const formatCurrencyDisplay = (amount: number | string | null | undefined, currencyContext?: string) => {
    const numericAmount = typeof amount === 'string' ? parseFloat(amount.replace(/,/g, '')) : amount;
    if (numericAmount === null || numericAmount === undefined || isNaN(numericAmount)) return 'N/A';
    // This basic version doesn't use currency symbol if currencyContext is not provided.
    // PensionProfile doesn't have its own currency field, so it assumes amounts are in a common/base currency.
    if (currencyContext) {
        try {
            return numericAmount.toLocaleString(undefined, { style: 'currency', currency: currencyContext, minimumFractionDigits: 0, maximumFractionDigits: 0 });
        } catch (e) {
            console.warn("Currency formatting failed for code:", currencyContext, e);
            return `${currencyContext} ${numericAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        }
    }
    return numericAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const getCountryDisplayName = (countryCode: PensionCountry) => {
    switch(countryCode) {
        case PensionCountry.INDIA: return "India";
        case PensionCountry.JAPAN: return "Japan";
        case PensionCountry.OTHER: return "Other";
        default:
            const str = String(countryCode);
            return str.charAt(0) + str.slice(1).toLowerCase().replace('_',' ');
    }
  }

  if (isInitialDataLoading) return <div className="text-center py-10 dark:text-gray-300">Loading initial data...</div>;

  if (error && profiles.length === 0 && assetCategories.length === 0) {
    return <div className="text-center py-10 text-red-500 dark:text-red-400">Error loading essential data: {error} <Button onClick={fetchInitialData} variant="outline" className="ml-2">Try Again</Button></div>;
  }

  return (
    <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg p-4 sm:p-6 md:p-8">
      {error && !isLoading && <p className="text-sm text-red-500 bg-red-100 dark:bg-red-900/30 dark:text-red-400 p-3 rounded-md mb-4">Last operation error: {error}</p>}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-3 sm:gap-4">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Your Pension Profiles</h2>
        <Button onClick={handleOpenFormForNew} className="flex items-center gap-2 w-full sm:w-auto bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white">
          <PlusCircle size={20} /> Add Pension Profile
        </Button>
      </div>

      {isLoading && profiles.length === 0 ? <div className="text-center py-10 dark:text-gray-300">Loading pension profiles...</div> :
       !isLoading && profiles.length === 0 && !error ? (
        <p className="text-gray-500 dark:text-gray-400 py-5 text-center">No pension profiles added yet. Click "Add Pension Profile".</p>
      ) : profiles.length > 0 ? (
        <div className="overflow-x-auto rounded-md border dark:border-gray-700">
          <Table>
            <TableHeader className="bg-gray-50 dark:bg-gray-800">
              <TableRow>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Country</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Employer</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Contribution</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Projected Payout</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</TableHead>
                <TableHead className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {profiles.map((profile) => (
                <TableRow key={profile.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center"><Globe size={16} className="mr-2 opacity-70"/>{getCountryDisplayName(profile.country)}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{profile.employerName || <span className="text-gray-400 dark:text-gray-500">N/A</span>}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{formatCurrencyDisplay(profile.contributionToDate)}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{formatCurrencyDisplay(profile.projectedPayout)}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{profile.assetCategory?.name || <span className="text-gray-400 dark:text-gray-500">N/A</span>}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <Button variant="outline" size="icon" onClick={() => handleOpenFormForEdit(profile)} title="Edit" className="dark:text-gray-300 dark:border-gray-600 hover:dark:bg-gray-700 w-8 h-8"><Edit size={16} /></Button>
                    <Button variant="destructive" size="icon" onClick={() => handleDelete(profile.id)} title="Delete" className="w-8 h-8"><Trash2 size={16} /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {!isInitialDataLoading && (
        <PensionForm
          profileToEdit={profileToEdit}
          assetCategories={assetCategories}
          isOpen={isFormOpen}
          onClose={handleCloseForm}
          onSave={handleSaveSuccess}
        />
      )}
    </div>
  );
}
