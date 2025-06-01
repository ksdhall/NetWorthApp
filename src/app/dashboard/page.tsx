// src/app/dashboard/page.tsx
import NetWorthSummaryWidget from '@/components/dashboard/widgets/NetWorthSummaryWidget';
import { Suspense } from 'react';

export default function DashboardPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8 text-gray-800 dark:text-gray-100">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* NetWorthSummaryWidget will be one of the first widgets */}
        {/* Wrap widgets that fetch data in Suspense if they are server components or for better loading UX */}
        {/* For client components like this one, Suspense is not strictly needed for data fetching within it, but good for consistency */}
        <Suspense fallback={<div className="col-span-1 md:col-span-2 h-48 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse"></div>}>
          <NetWorthSummaryWidget />
        </Suspense>

        {/* Placeholder for other widgets */}
        {/* <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div> */}
        {/* <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse md:col-span-2 lg:col-span-1"></div> */}
      </div>
    </div>
  );
}
