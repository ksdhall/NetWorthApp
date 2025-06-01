// src/app/dashboard/pension-funds/page.tsx
import PensionManager from '@/components/pension-funds/PensionManager';

export default function PensionFundsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">Pension Funds</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">Manage your pension fund profiles (e.g., EPF, NPS, Japan Pension).</p>
      <PensionManager />
    </div>
  );
}
