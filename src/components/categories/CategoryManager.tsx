// src/components/categories/CategoryManager.tsx
'use client';

import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2 } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AssetCategory, AssetType } from '@prisma/client';
import CategoryForm from './CategoryForm'; // Import the actual form

interface FetchedCategory extends AssetCategory {
  parentCategory?: { id: string; name: string } | null;
  subCategories?: { id: string; name: string }[];
}

export default function CategoryManager() {
  const [categories, setCategories] = useState<FetchedCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<FetchedCategory | null>(null);

  const fetchCategories = async () => {
    setIsLoading(true);
    // setError(null); // Keep error visible until next successful fetch
    try {
      const response = await fetch('/api/asset-categories');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || errorData.error || 'Failed to fetch asset categories');
      }
      const data = await response.json();
      setCategories(data);
      setError(null); // Clear error on successful fetch
    } catch (err: any) {
      setError(err.message);
      console.error("Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleOpenFormForNew = () => {
    setCategoryToEdit(null);
    setIsFormOpen(true);
  };

  const handleOpenFormForEdit = (category: FetchedCategory) => {
    setCategoryToEdit(category);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setCategoryToEdit(null);
  };

  const handleSaveSuccess = () => {
    fetchCategories();
    // Form calls onClose internally via Dialog's onOpenChange
  };

  const handleDelete = async (categoryId: string) => {
    if (!confirm("Are you sure you want to delete this category? This might fail if the category is in use or has sub-categories.")) return;

    setError(null);
    try {
      const response = await fetch(`/api/asset-categories/${categoryId}`, { method: 'DELETE' });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to delete category');
      }
      fetchCategories();
      // Using alert for now, toast notifications would be better UX
      alert(responseData.message || "Category deleted successfully.");
    } catch (err: any) {
      setError(err.message);
      // alert("Error deleting category: " + err.message); // Error is displayed above table
    }
  };

  const getCategoryTypeBadge = (type: AssetType) => {
    switch (type) {
      case AssetType.ASSET: return <Badge variant="outline" className="border-green-500 text-green-700 dark:border-green-400 dark:text-green-300 bg-green-50 dark:bg-green-900/30">Asset</Badge>;
      case AssetType.LIABILITY: return <Badge variant="outline" className="border-red-500 text-red-700 dark:border-red-400 dark:text-red-300 bg-red-50 dark:bg-red-900/30">Liability</Badge>;
      default: return <Badge variant="secondary" className="dark:bg-gray-700 dark:text-gray-300">Unknown</Badge>;
    }
  };

  if (isLoading && categories.length === 0) return <div className="text-center py-10 dark:text-gray-300">Loading categories...</div>;
  if (error && categories.length === 0 && !isLoading) return <div className="text-center py-10 text-red-500 dark:text-red-400">Error: {error} <Button onClick={fetchCategories} variant="outline" className="ml-2">Try Again</Button></div>;

  return (
    <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg p-4 sm:p-6 md:p-8">
      {error && <p className="text-sm text-red-500 bg-red-100 dark:bg-red-900/30 dark:text-red-400 p-3 rounded-md mb-4">Last operation error: {error}</p>}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-3 sm:gap-4">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Manage Categories</h2>
        <Button onClick={handleOpenFormForNew} className="flex items-center gap-2 w-full sm:w-auto bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white">
          <PlusCircle size={20} /> Add New Category
        </Button>
      </div>

      {categories.length === 0 && !isLoading ? (
        <p className="text-gray-500 dark:text-gray-400 py-5 text-center">No asset categories defined. Click "Add New Category".</p>
      ) : (
        <div className="overflow-x-auto rounded-md border dark:border-gray-700">
          <Table>
            <TableHeader className="bg-gray-50 dark:bg-gray-800">
              <TableRow>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Parent Category</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sub-Categories</TableHead>
                <TableHead className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {categories.map((cat) => (
                <TableRow key={cat.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{cat.name}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap">{getCategoryTypeBadge(cat.type)}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{cat.parentCategory?.name || <span className="text-gray-400 dark:text-gray-500">N/A</span>}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{cat.subCategories?.length || 0}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <Button variant="outline" size="icon" onClick={() => handleOpenFormForEdit(cat)} title="Edit" className="dark:text-gray-300 dark:border-gray-600 hover:dark:bg-gray-700 w-8 h-8"><Edit size={16} /></Button>
                    <Button variant="destructive" size="icon" onClick={() => handleDelete(cat.id)} title="Delete" className="w-8 h-8"><Trash2 size={16} /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CategoryForm
        categoryToEdit={categoryToEdit}
        allCategories={categories} // Pass the full list for parent selection
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSave={handleSaveSuccess}
      />
    </div>
  );
}
