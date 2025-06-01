// src/components/categories/CategoryForm.tsx
'use client';

import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { AssetCategory, AssetType } from '@prisma/client';
import { z } from 'zod';

// Zod schema for client-side validation
const categoryFormSchema = z.object({
  name: z.string().min(1, "Category name is required."),
  type: z.nativeEnum(AssetType, { required_error: "Category type is required." }),
  parentCategoryId: z.string().nullable().optional().transform(val => val === "" ? null : val),
});

type CategoryFormData = z.infer<typeof categoryFormSchema>;

interface CategoryFormProps {
  categoryToEdit?: AssetCategory | null;
  allCategories: Pick<AssetCategory, 'id' | 'name'>[]; // Only need id and name for parent dropdown
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export default function CategoryForm({
  categoryToEdit,
  allCategories,
  isOpen,
  onClose,
  onSave,
}: CategoryFormProps) {
  const [formData, setFormData] = useState<Partial<CategoryFormData>>({});
  const [errors, setErrors] = useState<z.ZodError<CategoryFormData> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (categoryToEdit) {
        setFormData({
          name: categoryToEdit.name,
          type: categoryToEdit.type,
          parentCategoryId: categoryToEdit.parentCategoryId || undefined,
        });
      } else {
        setFormData({
            name: '',
            type: AssetType.ASSET, // Default for new category
            parentCategoryId: undefined
        });
      }
      setErrors(null);
      setServerError(null);
    }
  }, [categoryToEdit, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: keyof CategoryFormData, value: string) => {
    const valToSet = (value === "none" || value === "") ? null : value;
    setFormData((prev) => ({ ...prev, [name]: valToSet as any }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors(null);
    setServerError(null);

    const processedData = {
        ...formData,
        // Ensure parentCategoryId is null if "none" or empty, otherwise use the value.
        // Zod transform on schema also handles empty string to null.
        parentCategoryId: formData.parentCategoryId === "none" ? null : formData.parentCategoryId,
    };

    const result = categoryFormSchema.safeParse(processedData);
    if (!result.success) {
      setErrors(result.error);
      return;
    }

    if (categoryToEdit && result.data.parentCategoryId === categoryToEdit.id) {
        setServerError("A category cannot be its own parent.");
        return;
    }

    setIsSubmitting(true);
    const method = categoryToEdit ? 'PUT' : 'POST';
    const url = categoryToEdit
      ? `/api/asset-categories/${categoryToEdit.id}`
      : '/api/asset-categories';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result.data),
      });

      const responseData = await response.json();
      if (!response.ok) {
        const message = Array.isArray(responseData.error)
          ? responseData.error.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ')
          : (responseData.error || 'Failed to save category');
        throw new Error(message);
      }

      onSave();
      onClose();
    } catch (err: any) {
      setServerError(err.message || "An unexpected error occurred.");
      console.error("Save error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getError = (field: keyof CategoryFormData) => {
    return errors?.errors.find(e => e.path.includes(field))?.message;
  }

  if (!isOpen) return null;

  const parentCategoryOptions = allCategories.filter(cat =>
    !categoryToEdit || cat.id !== categoryToEdit.id // Exclude current category from its own parent list
    // TODO: Also exclude children of the current category to prevent circular dependencies.
    // This requires a more complex check, possibly passing down hierarchy info or doing it server-side.
    // For now, only direct self-parenting is prevented.
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
        <DialogHeader>
          <DialogTitle>
            {categoryToEdit ? 'Edit Asset Category' : 'Add New Asset Category'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2 sm:pr-4">
          {serverError && <p className="text-sm text-red-500 bg-red-100 dark:bg-red-900/30 dark:text-red-200 p-3 rounded-md">{serverError}</p>}

          <div>
            <Label htmlFor="name">Category Name</Label>
            <Input id="name" name="name" value={formData.name || ''} onChange={handleChange} disabled={isSubmitting} className="dark:bg-gray-700 dark:border-gray-600"/>
            {getError('name') && <p className="text-xs text-red-500 mt-1">{getError('name')}</p>}
          </div>

          <div>
            <Label htmlFor="type">Category Type</Label>
            <Select name="type" value={formData.type || ''} onValueChange={(value) => handleSelectChange('type', value)} disabled={isSubmitting}>
              <SelectTrigger id="type" className="w-full dark:bg-gray-700 dark:border-gray-600">
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent className="dark:bg-gray-900 border-gray-700">
                {Object.values(AssetType).map(type => <SelectItem key={type} value={type} className="dark:focus:bg-gray-700">{type.charAt(0) + type.slice(1).toLowerCase()}</SelectItem>)}
              </SelectContent>
            </Select>
            {getError('type') && <p className="text-xs text-red-500 mt-1">{getError('type')}</p>}
          </div>

          <div>
            <Label htmlFor="parentCategoryId">Parent Category (Optional)</Label>
            <Select name="parentCategoryId" value={formData.parentCategoryId || 'none'} onValueChange={(value) => handleSelectChange('parentCategoryId', value)} disabled={isSubmitting}>
              <SelectTrigger id="parentCategoryId" className="w-full dark:bg-gray-700 dark:border-gray-600">
                <SelectValue placeholder="Select parent (optional)..." />
              </SelectTrigger>
              <SelectContent className="dark:bg-gray-900 border-gray-700">
                <SelectItem value="none" className="dark:focus:bg-gray-700">None (Top Level)</SelectItem>
                {parentCategoryOptions.map(cat => <SelectItem key={cat.id} value={cat.id} className="dark:focus:bg-gray-700">{cat.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {getError('parentCategoryId') && <p className="text-xs text-red-500 mt-1">{getError('parentCategoryId')}</p>}
          </div>

          <DialogFooter className="pt-5">
            <DialogClose asChild><Button type="button" variant="outline" onClick={onClose} className="dark:border-gray-600 hover:dark:bg-gray-700">Cancel</Button></DialogClose>
            <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600">{isSubmitting ? (categoryToEdit ? 'Saving...' : 'Adding...') : (categoryToEdit ? 'Save Changes' : 'Add Category')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
