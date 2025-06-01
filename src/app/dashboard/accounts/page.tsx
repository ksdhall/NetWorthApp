// src/app/dashboard/accounts/page.tsx
import AccountManager from '@/components/accounts/AccountManager'; // To be created

export default function AccountsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">Financial Accounts</h1>
      <AccountManager />
    </div>
  );
}
