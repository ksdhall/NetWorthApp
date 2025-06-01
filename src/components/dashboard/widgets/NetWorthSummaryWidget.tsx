// src/components/dashboard/widgets/NetWorthSummaryWidget.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button"; // For Try Again button
import { TrendingUp, TrendingDown, Scale, CalendarDays, AlertCircle } from "lucide-react";

interface NetWorthData {
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
  lastUpdatedDate: string | null;
  accountsConsidered?: number;
  accountsWithBalancesCounted?: number;
}

const formatCurrency = (value: number | null | undefined, currency: string = 'USD') => {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  } catch (e) {
    console.warn("Currency formatting failed for code:", currency, "value:", value, e);
    return `${currency} ${value.toFixed(2)}`; // Fallback basic format
  }
};

export default function NetWorthSummaryWidget() {
  const [data, setData] = useState<NetWorthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/dashboard/net-worth-summary');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to parse error from server" }));
        throw new Error(errorData.error || 'Failed to fetch net worth summary');
      }
      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
      console.error("Fetch error in NetWorthSummaryWidget:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <Card className="dark:bg-gray-800/90 shadow-lg col-span-1 md:col-span-2 xl:col-span-2 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-700 dark:text-gray-300">Net Worth Summary</CardTitle>
          <CardDescription className="dark:text-gray-400">Calculating your financial snapshot...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          <div className="h-8 bg-gray-300 dark:bg-gray-700/50 rounded w-3/4 animate-pulse"></div>
          <div className="h-6 bg-gray-300 dark:bg-gray-700/50 rounded w-1/2 animate-pulse"></div>
          <div className="h-6 bg-gray-300 dark:bg-gray-700/50 rounded w-1/2 animate-pulse"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-700/50 rounded w-1/4 mt-2 animate-pulse"></div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="dark:bg-gray-800/90 shadow-lg col-span-1 md:col-span-2 xl:col-span-2 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-red-600 dark:text-red-400 flex items-center">
            <AlertCircle size={24} className="mr-2"/> Error Fetching Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-red-500 dark:text-red-400 mb-3">{error}</p>
          <Button onClick={fetchData} variant="outline" className="dark:text-gray-300 dark:border-gray-600 hover:dark:bg-gray-700">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) { // Should ideally be covered by isLoading or error state
    return (
       <Card className="dark:bg-gray-800/90 shadow-lg col-span-1 md:col-span-2 xl:col-span-2 backdrop-blur-sm">
        <CardHeader><CardTitle className="text-xl font-bold dark:text-gray-200">Net Worth Summary</CardTitle></CardHeader>
        <CardContent className="p-6"><p className="dark:text-gray-400">No data available to calculate net worth.</p></CardContent>
      </Card>
    );
  }

  // TODO: Fetch user's preferred currency from session or settings. Defaulting to USD for now.
  const userPreferredCurrency = 'USD';

  return (
    <Card className="dark:bg-gray-800/90 shadow-lg col-span-1 md:col-span-2 xl:col-span-2 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl font-bold text-gray-800 dark:text-white flex items-center">
          <Scale size={28} className="mr-3 text-indigo-600 dark:text-indigo-400"/>
          Net Worth Summary
        </CardTitle>
        {data.lastUpdatedDate && (
          <CardDescription className="text-xs text-gray-500 dark:text-gray-400 flex items-center pt-1">
            <CalendarDays size={14} className="mr-1.5"/>
            Last updated: {new Date(data.lastUpdatedDate).toLocaleDateString('default', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}
             <span className="ml-2 text-gray-400 dark:text-gray-500 text-xs">({data.accountsWithBalancesCounted}/{data.accountsConsidered} accounts)</span>
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-3 p-6">
        <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="flex items-center">
            <TrendingUp size={24} className="mr-3 text-green-500 dark:text-green-400" />
            <span className="text-md font-medium text-green-700 dark:text-green-300">Total Assets</span>
          </div>
          <span className="text-lg font-semibold text-green-700 dark:text-green-200">{formatCurrency(data.totalAssets, userPreferredCurrency)}</span>
        </div>

        <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
          <div className="flex items-center">
            <TrendingDown size={24} className="mr-3 text-red-500 dark:text-red-400" />
            <span className="text-md font-medium text-red-700 dark:text-red-300">Total Liabilities</span>
          </div>
          <span className="text-lg font-semibold text-red-700 dark:text-red-200">{formatCurrency(data.totalLiabilities, userPreferredCurrency)}</span>
        </div>

        <div className="flex items-center justify-between p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border-t-2 border-indigo-500 dark:border-indigo-400 mt-3">
          <div className="flex items-center">
             <Scale size={24} className="mr-3 text-indigo-600 dark:text-indigo-300" />
            <span className="text-lg font-semibold text-indigo-700 dark:text-indigo-200">Net Worth</span>
          </div>
          <span className="text-xl font-bold text-indigo-800 dark:text-indigo-100">{formatCurrency(data.netWorth, userPreferredCurrency)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
