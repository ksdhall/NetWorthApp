// src/components/dashboard/widgets/NetWorthTrendWidget.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, AlertTriangle, AlertCircle } from "lucide-react"; // Added AlertCircle

interface TrendDataPoint {
  date: string; // YYYY-MM-DD
  totalAssets: number;
  totalLiabilities: number;
  netWorth: number;
}

interface ApiResponse {
    trendData: TrendDataPoint[];
    categories: string[]; // Though not used by this specific chart, it's part of the API response
}

const formatCurrencyForAxis = (value: number) => {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  if (Math.abs(value) >= 1000000000) return `${(value / 1000000000).toFixed(1)}B`;
  if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
};

const formatDateForAxis = (dateString: string) => {
  // Dates from API are YYYY-MM-DD. Parse as UTC to avoid timezone shifts.
  const dateParts = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
  return date.toLocaleDateString('default', { month: 'short', year: '2-digit', timeZone: 'UTC' });
};

// Custom Tooltip Content for better styling and information
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const date = new Date(label + 'T00:00:00Z'); // Ensure label (date string) is treated as UTC
    const formattedDate = date.toLocaleDateString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    // TODO: Use user's preferred currency from context/settings
    const userPreferredCurrency = 'USD';

    return (
      <div className="bg-white dark:bg-gray-800 p-3 shadow-lg rounded-md border dark:border-gray-700">
        <p className="label text-sm font-semibold text-gray-700 dark:text-gray-300">{formattedDate}</p>
        {payload.map((pld: any, index: number) => (
          <p key={index} style={{ color: pld.color }} className="text-sm">
            {`${pld.name}: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: userPreferredCurrency }).format(pld.value)}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};


export default function NetWorthTrendWidget() {
  const [chartData, setChartData] = useState<TrendDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/dashboard/net-worth-trend');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to parse error from server" }));
        throw new Error(errorData.error || 'Failed to fetch net worth trend data');
      }
      const result: ApiResponse = await response.json();
      setChartData(result.trendData);
    } catch (err: any) {
      setError(err.message);
      console.error("Fetch error in NetWorthTrendWidget:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <Card className="dark:bg-gray-800/90 shadow-lg col-span-1 md:col-span-3 xl:col-span-2 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-700 dark:text-gray-300">Net Worth Trend</CardTitle>
          <CardDescription className="dark:text-gray-400">Loading chart data...</CardDescription>
        </CardHeader>
        <CardContent className="p-6 h-[300px]">
          <div className="h-full bg-gray-300 dark:bg-gray-700/50 rounded animate-pulse"></div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="dark:bg-gray-800/90 shadow-lg col-span-1 md:col-span-3 xl:col-span-2 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-red-600 dark:text-red-400 flex items-center">
            <AlertCircle size={22} className="mr-2"/> Error Loading Chart
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-red-500 dark:text-red-400 mb-3">{error}</p>
          <Button onClick={fetchData} variant="outline" className="dark:text-gray-300 dark:border-gray-600 hover:dark:bg-gray-700">Try Again</Button>
        </CardContent>
      </Card>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
       <Card className="dark:bg-gray-800/90 shadow-lg col-span-1 md:col-span-3 xl:col-span-2 backdrop-blur-sm">
        <CardHeader><CardTitle className="text-xl font-bold dark:text-gray-200">Net Worth Trend</CardTitle></CardHeader>
        <CardContent className="p-6 h-[300px] flex items-center justify-center">
            <p className="text-gray-500 dark:text-gray-400">No data available to display trend chart.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="dark:bg-gray-800/90 shadow-lg col-span-1 md:col-span-3 xl:col-span-2 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-bold text-gray-800 dark:text-white flex items-center">
          <TrendingUp size={24} className="mr-2 text-indigo-600 dark:text-indigo-400"/>
          Net Worth Trend
        </CardTitle>
        <CardDescription className="dark:text-gray-400">Monthly snapshot of your assets, liabilities, and net worth.</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" strokeOpacity={0.5}/>
            <XAxis
                dataKey="date"
                tickFormatter={formatDateForAxis}
                className="text-xs dark:fill-gray-400"
                stroke="currentColor"
                dy={5}
            />
            <YAxis
                tickFormatter={formatCurrencyForAxis}
                className="text-xs dark:fill-gray-400"
                stroke="currentColor"
                width={70}
                dx={-5}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{fontSize: "0.8rem", paddingTop: "10px"}}/>
            <Line type="monotone" dataKey="totalAssets" name="Total Assets" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="totalLiabilities" name="Total Liabilities" stroke="#f43f5e" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="netWorth" name="Net Worth" stroke="#6366f1" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
