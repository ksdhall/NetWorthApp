// src/app/dashboard/addresses/page.tsx
import AddressManager from '@/components/addresses/AddressManager'; // To be created

export default function AddressesPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">Address History</h1>
      <AddressManager />
    </div>
  );
}
