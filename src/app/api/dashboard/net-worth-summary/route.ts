import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient, AssetType } from '@prisma/client'; // Removed AccountType
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

export async function GET(_request: Request) { // Renamed 'request' to '_request'
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Fetch all financial accounts and their latest balance entry
    const accounts = await prisma.account.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        assetCategory: {
          select: { type: true }
        },
        balanceEntries: {
          orderBy: { entryDate: 'desc' },
          take: 1,
        },
      },
    });

    let totalAssets = new Decimal(0);
    let totalLiabilities = new Decimal(0);
    let lastUpdatedDate: Date | null = null;
    let accountsUsedInCalculation = 0;

    for (const account of accounts) {
      if (account.balanceEntries.length > 0) {
        const latestBalance = account.balanceEntries[0];
        // balanceInBase is assumed to be in the user's preferred base currency or a common currency.
        // Prisma's Decimal type is used for calculations.
        const balanceValue = latestBalance.balanceInBase;

        if (balanceValue !== null) {
          accountsUsedInCalculation++;
          if (account.assetCategory?.type === AssetType.ASSET) {
            totalAssets = totalAssets.plus(balanceValue);
          } else if (account.assetCategory?.type === AssetType.LIABILITY) {
            // Liabilities are typically positive numbers representing debt.
            // We add them to totalLiabilities, and net worth is Assets - Liabilities.
            totalLiabilities = totalLiabilities.plus(balanceValue);
          }
          // Accounts without a category type or if category is null are not counted.

          if (lastUpdatedDate === null || latestBalance.entryDate > lastUpdatedDate) {
            lastUpdatedDate = latestBalance.entryDate;
          }
        }
      }
    }

    // 2. Fetch Credit Cards (treating their current outstanding as a liability)
    // This assumes credit card data might not have monthly BalanceEntry records like bank accounts.
    // We need a way to get the "current outstanding balance" for credit cards.
    // The CreditCard model currently has `creditLimit`. It does NOT have a current balance field.
    // This part is a placeholder for if/when credit card balances are tracked.
    // For now, if a CreditCard is linked to an AssetCategory of type LIABILITY, it implies its limit
    // or some other measure should be a liability. This is complex without a current balance field.
    //
    // Let's assume for now that if a CreditCard is linked to an AssetCategory of type LIABILITY,
    // its *creditLimit* is considered a potential liability if we don't have current balance.
    // This is not ideal, as credit limit isn't actual debt.
    // A better system would involve transactions or statements for credit cards to get actual balance.
    //
    // Given the current schema, we will *not* include credit card limits directly as liabilities
    // unless they have a balance entry mechanism or a current balance field.
    // The user should create a "Liability" type Account for credit cards if they want to track
    // the balance manually via BalanceEntry.

    const netWorth = totalAssets.minus(totalLiabilities);

    return NextResponse.json({
      totalAssets: totalAssets.toNumber(),
      totalLiabilities: totalLiabilities.toNumber(),
      netWorth: netWorth.toNumber(),
      lastUpdatedDate: lastUpdatedDate ? lastUpdatedDate.toISOString() : null,
      accountsConsidered: accounts.length,
      accountsWithBalancesCounted: accountsUsedInCalculation,
    });

  } catch (error) {
    console.error("Error calculating net worth summary:", error);
    if (error instanceof Error) {
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
