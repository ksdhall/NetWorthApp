// src/app/dashboard/identity/page.tsx
import IdentityManager from '@/components/identity/IdentityManager'; // To be created

export default function IdentityPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">Identity Documents</h1>
      <IdentityManager />
    </div>
  );
}
