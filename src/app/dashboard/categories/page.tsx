// src/app/dashboard/categories/page.tsx
import CategoryManager from '@/components/categories/CategoryManager'; // To be created

export default function CategoriesPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">Asset Categories</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">Manage categories for your assets and liabilities. These categories will be used when adding financial accounts and other assets.</p>
      <CategoryManager />
    </div>
  );
}
