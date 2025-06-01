// src/components/identity/IdentityManager.tsx
'use client';

import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2 } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { IdentityDocument, IdentityDocumentType } from '@prisma/client'; // Import IdentityDocumentType
import IdentityDocumentForm from './IdentityDocumentForm'; // Import the form

interface FetchedIdentityDocument extends IdentityDocument {}

export default function IdentityManager() {
  const [documents, setDocuments] = useState<FetchedIdentityDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); // For general errors / last operation error

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [documentToEdit, setDocumentToEdit] = useState<FetchedIdentityDocument | null>(null);

  const fetchDocuments = async () => {
    setIsLoading(true);
    // Don't clear general error here, so user can see it until next successful fetch
    // setError(null);
    try {
      const response = await fetch('/api/identity-documents');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch documents');
      }
      const data = await response.json();
      setDocuments(data);
      setError(null); // Clear error on successful fetch
    } catch (err: any) {
      setError(err.message);
      console.error("Fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleOpenFormForNew = () => {
    setDocumentToEdit(null);
    setIsFormOpen(true);
  };

  const handleOpenFormForEdit = (doc: FetchedIdentityDocument) => {
    setDocumentToEdit(doc);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setDocumentToEdit(null);
  };

  const handleSaveSuccess = () => {
    fetchDocuments();
    // Form is closed by its own internal logic on successful save via onOpenChange of Dialog
    // So, no need to call handleCloseForm() here explicitly if Dialog onOpenChange handles it.
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Are you sure you want to delete this document? This action cannot be undone.")) return;

    setError(null); // Clear previous errors
    try {
      const response = await fetch(`/api/identity-documents/${docId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete document');
      }
      fetchDocuments();
      // alert("Document deleted successfully."); // Consider using a toast notification library
    } catch (err: any) {
      setError(err.message);
      console.error("Delete error:", err);
      // alert("Error deleting document: " + err.message);
    }
  };

  if (isLoading && documents.length === 0) return <div className="text-center py-10 dark:text-gray-300">Loading documents...</div>;
  // Show error prominently if it prevents initial load
  if (error && documents.length === 0 && !isLoading) return <div className="text-center py-10 text-red-500 dark:text-red-400">Error: {error} <Button onClick={fetchDocuments} variant="outline" className="ml-2">Try Again</Button></div>;


  return (
    <div className="bg-white dark:bg-gray-900 shadow-xl rounded-lg p-4 sm:p-6 md:p-8">
      {error && <p className="text-sm text-red-500 bg-red-100 dark:bg-red-900/30 dark:text-red-400 p-3 rounded-md mb-4">Last operation error: {error}</p>}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-3 sm:gap-4">
        <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Your Documents</h2>
        <Button onClick={handleOpenFormForNew} className="flex items-center gap-2 w-full sm:w-auto bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white">
          <PlusCircle size={20} />
          Add New Document
        </Button>
      </div>

      {documents.length === 0 && !isLoading ? (
        <p className="text-gray-500 dark:text-gray-400 py-5 text-center">You haven't added any identity documents yet. Click "Add New Document" to get started.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border dark:border-gray-700">
          <Table>
            <TableHeader className="bg-gray-50 dark:bg-gray-800">
              <TableRow>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Number</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Expiry Date</TableHead>
                <TableHead className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Primary</TableHead>
                <TableHead className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {documents.map((doc) => (
                <TableRow key={doc.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{doc.docType.replace('_', ' ')}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{doc.docNumber}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">{doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : 'N/A'}</TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap">
                    {doc.isPrimary && <Badge className="bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100">Primary</Badge>}
                  </TableCell>
                  <TableCell className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <Button variant="outline" size="icon" onClick={() => handleOpenFormForEdit(doc)} title="Edit" className="dark:text-gray-300 dark:border-gray-600 hover:dark:bg-gray-700 w-8 h-8">
                      <Edit size={16} />
                    </Button>
                    <Button variant="destructive" size="icon" onClick={() => handleDelete(doc.id)} title="Delete" className="w-8 h-8">
                      <Trash2 size={16} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <IdentityDocumentForm
        documentToEdit={documentToEdit}
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        onSave={handleSaveSuccess}
      />
    </div>
  );
}
