// src/app/dashboard/fixed-deposits/page.tsx
import FixedDepositManager from '@/components/fixed-deposits/FixedDepositManager';

export default function FixedDepositsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">Fixed Deposits (FDs)</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">Manage your fixed deposit investments and track their maturity.</p>
      <FixedDepositManager />
    </div>
  );
}
