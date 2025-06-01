import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient, AssetType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const balanceEntries = await prisma.balanceEntry.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        account: { // Account is included to access its assetCategory
          select: {
            assetCategory: { // AssetCategory is on Account model
              select: {
                type: true, // We need AssetType.ASSET or AssetType.LIABILITY
              },
            },
          },
        },
      },
      orderBy: {
        entryDate: 'asc', // Process chronologically
      },
    });

    if (balanceEntries.length === 0) {
      return NextResponse.json([]);
    }

    // Aggregate balances by month (YYYY-MM string for the key)
    const monthlyAggregates: Record<string, {
        totalAssets: Decimal,
        totalLiabilities: Decimal,
        // Store the actual Date object for sorting, ensuring it's UTC first of month
        dateObject: Date
    }> = {};

    for (const entry of balanceEntries) {
      // Ensure balanceInBase is not null and assetCategory type is available
      if (entry.balanceInBase === null || !entry.account.assetCategory?.type) {
        continue;
      }

      // Use UTC methods to avoid timezone shifts when creating month key and dateObject
      const year = entry.entryDate.getUTCFullYear();
      const month = entry.entryDate.getUTCMonth(); // 0-indexed
      const entryMonthKey = `${year}-${String(month + 1).padStart(2, '0')}`; // YYYY-MM

      const firstOfMonthDate = new Date(Date.UTC(year, month, 1));

      if (!monthlyAggregates[entryMonthKey]) {
        monthlyAggregates[entryMonthKey] = {
          totalAssets: new Decimal(0),
          totalLiabilities: new Decimal(0),
          dateObject: firstOfMonthDate
        };
      }

      const balance = entry.balanceInBase; // This is a Decimal from Prisma

      if (entry.account.assetCategory.type === AssetType.ASSET) {
        monthlyAggregates[entryMonthKey].totalAssets = monthlyAggregates[entryMonthKey].totalAssets.plus(balance);
      } else if (entry.account.assetCategory.type === AssetType.LIABILITY) {
        monthlyAggregates[entryMonthKey].totalLiabilities = monthlyAggregates[entryMonthKey].totalLiabilities.plus(balance);
      }
    }

    const trendData = Object.values(monthlyAggregates).map(agg => ({
      date: agg.dateObject.toISOString().substring(0, 10), // YYYY-MM-DD format
      totalAssets: agg.totalAssets.toNumber(),
      totalLiabilities: agg.totalLiabilities.toNumber(),
      netWorth: agg.totalAssets.minus(agg.totalLiabilities).toNumber(),
    }));

    // Sort by dateObject to ensure correct chronological order for the chart
    trendData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return NextResponse.json(trendData);

  } catch (error) {
    console.error("Error fetching net worth trend data:", error);
    if (error instanceof Error) {
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
