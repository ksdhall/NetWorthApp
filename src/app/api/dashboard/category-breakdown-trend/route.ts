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
        account: {
          select: {
            assetCategory: {
              select: {
                id: true,
                name: true,
                type: true,
              },
            },
          },
        },
      },
      orderBy: {
        entryDate: 'asc',
      },
    });

    if (balanceEntries.length === 0) {
      return NextResponse.json({ trendData: [], categories: [] });
    }

    const monthlyCategoryAggregates: Record<string, {
        dateObject: Date; // Store actual Date object for sorting & consistent date representation
        [categoryName: string]: Decimal | Date; // Category balances or the dateObject
    }> = {};

    const allCategoryNames = new Set<string>();

    for (const entry of balanceEntries) {
      if (entry.balanceInBase === null || !entry.account.assetCategory?.name) { // Ensure category name exists
        continue;
      }

      const year = entry.entryDate.getUTCFullYear();
      const month = entry.entryDate.getUTCMonth(); // 0-indexed
      const entryMonthKey = `${year}-${String(month + 1).padStart(2, '0')}`; // YYYY-MM

      const categoryName = entry.account.assetCategory.name;
      allCategoryNames.add(categoryName);

      if (!monthlyCategoryAggregates[entryMonthKey]) {
        monthlyCategoryAggregates[entryMonthKey] = {
          dateObject: new Date(Date.UTC(year, month, 1))
        };
      }

      const currentCategoryBalance = monthlyCategoryAggregates[entryMonthKey][categoryName] as Decimal || new Decimal(0);
      // For liabilities, sum them as positive values if balanceInBase represents the debt amount.
      // If balanceInBase for liabilities is stored as negative, this sum will correctly reduce net worth.
      // The key is consistent data entry for liability balances.
      monthlyCategoryAggregates[entryMonthKey][categoryName] = currentCategoryBalance.plus(entry.balanceInBase);
    }

    const sortedCategoryNamesArray = Array.from(allCategoryNames).sort();

    const trendData = Object.values(monthlyCategoryAggregates).map(monthlyData => {
      const record: { date: string; [categoryName: string]: number | string } = {
        date: (monthlyData.dateObject as Date).toISOString().substring(0, 10), // YYYY-MM-DD
      };
      sortedCategoryNamesArray.forEach(catName => {
        const balance = monthlyData[catName] as Decimal | undefined;
        record[catName] = balance ? balance.toNumber() : 0;
      });
      return record;
    });

    trendData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return NextResponse.json({
        trendData,
        categories: sortedCategoryNamesArray
    });

  } catch (error) {
    console.error("Error fetching category breakdown trend data:", error);
    if (error instanceof Error) {
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
