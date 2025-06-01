// src/app/dashboard/balances/page.tsx
import BalanceManager from '@/components/balances/BalanceManager';

export default function BalancesPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">Account Balances</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">Track your monthly account balances and snapshots.</p>
      <BalanceManager />
    </div>
  );
}
