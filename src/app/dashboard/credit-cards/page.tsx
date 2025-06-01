// src/app/dashboard/credit-cards/page.tsx
import CreditCardManager from '@/components/credit-cards/CreditCardManager';

export default function CreditCardsPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-gray-800 dark:text-white">Credit Cards</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">Manage your credit card details and track associated information.</p>
      <CreditCardManager />
    </div>
  );
}
