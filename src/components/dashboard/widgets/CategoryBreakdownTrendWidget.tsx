// src/components/dashboard/widgets/CategoryBreakdownTrendWidget.tsx
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Layers, AlertCircle } from "lucide-react"; // Changed AlertTriangle to AlertCircle

interface CategoryTrendDataPoint {
  date: string; // YYYY-MM-DD
  [categoryName: string]: number | string; // Balances for each category
}

interface CategoryBreakdownApiResponse {
  trendData: CategoryTrendDataPoint[];
  categories: string[]; // List of all category names
}

const formatCurrencyForAxis = (value: number) => {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  if (Math.abs(value) >= 1000000000) return `${(value / 1000000000).toFixed(1)}B`;
  if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
};

const formatDateForAxis = (dateString: string) => {
  const dateParts = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
  return date.toLocaleDateString('default', { month: 'short', year: '2-digit', timeZone: 'UTC' });
};

const generateCategoryColors = (categoryNames: string[]): { [key: string]: string } => {
  const baseColors = [
    "#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#d0ed57", "#a4de6c", "#8dd1e1",
    "#83a6ed", "#fa8072", "#7b68ee", "#00fa9a", "#ffd700", "#ff6347", "#40e0d0",
    "#c71585", "#3cb371", "#ffa07a", "#6a5acd", "#deb887", "#ffb6c1"
  ];
  const categoryColors: { [key: string]: string } = {};
  categoryNames.forEach((name, index) => {
    categoryColors[name] = baseColors[index % baseColors.length];
  });
  return categoryColors;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const date = new Date(label + 'T00:00:00Z');
    const formattedDate = date.toLocaleDateString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const userPreferredCurrency = 'USD'; // TODO: Use user's preferred currency

    return (
      <div className="bg-white dark:bg-gray-800 p-3 shadow-lg rounded-md border dark:border-gray-700">
        <p className="label text-sm font-semibold text-gray-700 dark:text-gray-300">{formattedDate}</p>
        {payload.map((pld: any, index: number) => (
          <p key={index} style={{ color: pld.stroke || pld.fill }} className="text-sm">
            {`${pld.name}: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: userPreferredCurrency }).format(pld.value)}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};


export default function CategoryBreakdownTrendWidget() {
  const [apiResponse, setApiResponse] = useState<CategoryBreakdownApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryColors, setCategoryColors] = useState<{ [key: string]: string }>({});

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/dashboard/category-breakdown-trend');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({error: "Failed to parse error from server"}));
        throw new Error(errorData.error || 'Failed to fetch category breakdown data');
      }
      const result: CategoryBreakdownApiResponse = await response.json();
      setApiResponse(result);
      if (result.categories) {
        setCategoryColors(generateCategoryColors(result.categories));
      }
    } catch (err: any) {
      setError(err.message);
      console.error("Fetch error in CategoryBreakdownTrendWidget:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <Card className="dark:bg-gray-800/90 shadow-lg col-span-1 md:col-span-3 xl:col-span-2 backdrop-blur-sm"> {/* Consistent span with NetWorthTrend */}
        <CardHeader>
          <CardTitle className="text-xl font-bold text-gray-700 dark:text-gray-300">Category Breakdown Trend</CardTitle>
          <CardDescription className="dark:text-gray-400">Loading chart data...</CardDescription>
        </CardHeader>
        <CardContent className="p-6 h-[350px]"> {/* Increased height for area chart */}
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

  if (!apiResponse || !apiResponse.trendData || apiResponse.trendData.length === 0) {
    return (
       <Card className="dark:bg-gray-800/90 shadow-lg col-span-1 md:col-span-3 xl:col-span-2 backdrop-blur-sm">
        <CardHeader><CardTitle className="text-xl font-bold dark:text-gray-200">Category Breakdown Trend</CardTitle></CardHeader>
        <CardContent className="p-6 h-[350px] flex items-center justify-center">
            <p className="text-gray-500 dark:text-gray-400">No data available to display category breakdown.</p>
        </CardContent>
      </Card>
    );
  }

  const { trendData, categories } = apiResponse;

  return (
    <Card className="dark:bg-gray-800/90 shadow-lg col-span-1 md:col-span-3 xl:col-span-2 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-bold text-gray-800 dark:text-white flex items-center">
          <Layers size={24} className="mr-2 text-purple-600 dark:text-purple-400"/>
          Category Breakdown Trend
        </CardTitle>
        <CardDescription className="dark:text-gray-400">Monthly asset and liability composition by category.</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={trendData} margin={{ top: 5, right: 20, left: 10, bottom: 50 }}>
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
            <Legend wrapperStyle={{fontSize: "0.8rem", paddingTop: "20px"}}/>
            {categories.map((catName) => (
              <Area
                key={catName}
                type="monotone"
                dataKey={catName}
                stackId="1"
                stroke={categoryColors[catName] || '#333'} // Fallback stroke
                fill={categoryColors[catName] || '#8884d8'}
                fillOpacity={0.7}
                name={catName}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
