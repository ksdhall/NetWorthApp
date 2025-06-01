// src/components/addresses/AddressManager.tsx
'use client';

import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2 } from "lucide-react"; // Removed MapPin as it wasn't used
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AddressHistory } from '@prisma/client';
import AddressForm from './AddressForm'; // Import the actual form

interface FetchedAddress extends AddressHistory {}

export default function AddressManager() {
  const [addresses, setAddresses] = useState<FetchedAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [addressToEdit, setAddressToEdit] = useState<FetchedAddress | null>(null);

  const fetchAddresses = async () => {
    setIsLoading(true);
    // setError(null); // Keep error until successful fetch
    try {
      const response = await fetch('/api/addresses');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || errorData.error || 'Failed to fetch addresses');
      }
      const data = await response.json();
      setAddresses(data);
      setError(null); // Clear error on successful fetch
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAddresses();
  }, []);

  const handleOpenFormForNew = () => {
    setAddressToEdit(null);
    setIsFormOpen(true);
  };

  const handleOpenFormForEdit = (address: FetchedAddress) => {
    setAddressToEdit(address);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setAddressToEdit(null);
  };

  const handleSaveSuccess = () => {
    fetchAddresses();
    // The form itself calls onClose via Dialog's onOpenChange when successfully submitted
  };

  const handleDelete = async (addressId: string) => {
    if (!confirm("Are you sure you want to delete this address? This action cannot be undone.")) return;

    setError(null);
    try {
      const response = await fetch(`/api/addresses/${addressId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || errorData.error || 'Failed to delete address');
      }
      fetchAddresses();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (isLoading && addresses.length === 0) return <div className="text-center py-10 dark:text-gray-300">Loading addresses...</div>;
  if (error && addresses.length === 0 && !isLoading) return <div className="text-center py-10 text-red-500 dark:text-red-400">Error: {error} <Button onClick={fetchAddresses} variant="outline" className="ml-2">Try Again</Button></div>;

  return (
    <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg p-4 sm:p-6 md:p-8">
      {error && <p className="text-sm text-red-500 bg-red-100 dark:bg-red-900/30 dark:text-red-400 p-3 rounded-md mb-4">Last operation error: {error}</p>}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-3 sm:gap-4">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Your Addresses</h2>
        <Button onClick={handleOpenFormForNew} className="flex items-center gap-2 w-full sm:w-auto bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white">
          <PlusCircle size={20} />
          Add New Address
        </Button>
      </div>

      {addresses.length === 0 && !isLoading ? (
        <p className="text-gray-500 dark:text-gray-400 py-5 text-center">You haven't added any addresses yet. Click "Add New Address" to get started.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border dark:border-gray-700">
          <Table>
            <TableHeader className="bg-gray-50 dark:bg-gray-800">
              <TableRow>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Address</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">City/State/Zip</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Country</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Dates Active</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Current</TableHead>
                <TableHead className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {addresses.map((address) => (
                <TableRow key={address.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{address.type.charAt(0) + address.type.slice(1).toLowerCase().replace('_', ' ')}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{address.line1}{address.line2 ? `, ${address.line2}` : ''}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{address.city}, {address.state} {address.postalCode}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{address.country}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {new Date(address.fromDate).toLocaleDateString()} -
                    {address.toDate ? new Date(address.toDate).toLocaleDateString() : 'Present'}
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap">
                    {address.isCurrent && <Badge className="bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100">Current</Badge>}
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <Button variant="outline" size="icon" onClick={() => handleOpenFormForEdit(address)} title="Edit" className="dark:text-gray-300 dark:border-gray-600 hover:dark:bg-gray-700 w-8 h-8">
                      <Edit size={16} />
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => handleDelete(address.id)} title="Delete" className="w-8 h-8">
                      <Trash2 size={16} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AddressForm
        addressToEdit={addressToEdit}
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSave={handleSaveSuccess}
      />
    </div>
  );
}
