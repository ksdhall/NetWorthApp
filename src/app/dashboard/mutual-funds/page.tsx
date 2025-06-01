// src/app/dashboard/mutual-funds/page.tsx
import MutualFundManager from '@/components/mutual-funds/MutualFundManager';

export default function MutualFundsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">Mutual Funds</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">Track your mutual fund investments, their performance, and related details.</p>
      <MutualFundManager />
    </div>
  );
}
