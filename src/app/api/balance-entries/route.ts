import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Helper to normalize date to the first of the month, UTC Midnight
const normalizeToFirstOfMonthUTC = (date: Date): Date => {
  const d = new Date(date); // Ensure it's a new Date object
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
};

// Zod schema for creating a BalanceEntry
const createBalanceEntrySchema = z.object({
  accountId: z.string().min(1, "Account ID is required."), // CUIDs/UUIDs are strings
  entryDate: z.preprocess((arg) => {
    if (typeof arg === 'string' || arg instanceof Date) return new Date(arg);
    return undefined; // Let Zod handle if it's not a valid date precursor
  }, z.date({ required_error: "Entry date is required" })),
  balanceOriginal: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number({ required_error: "Original balance is required" })
  ),
  currency: z.string().min(2, "Currency is required").max(10, "Currency code too long"),
  exchangeRateToBase: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? null : (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number().positive("Exchange rate must be positive if provided").nullable().optional()
  ),
  notes: z.string().optional().nullable().transform(val => val === "" ? null : val),
  locked: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const json = await request.json();
    const data = createBalanceEntrySchema.parse(json);

    const account = await prisma.account.findUnique({
      where: { id: data.accountId },
    });
    if (!account || account.userId !== session.user.id) {
      return NextResponse.json({ error: 'Account not found or access denied' }, { status: 404 });
    }

    if (account.currency.toUpperCase() !== data.currency.toUpperCase()) {
        return NextResponse.json({ error: `Balance currency (${data.currency.toUpperCase()}) must match account currency (${account.currency.toUpperCase()}).` }, { status: 400 });
    }

    const normalizedEntryDate = normalizeToFirstOfMonthUTC(data.entryDate);

    let balanceInBase: number | null = data.balanceOriginal; // Default to original if no rate or currency match needed for base
    // A more sophisticated system would use user's preferred base currency from user settings
    // and fetch actual exchange rates from an external service or a dedicated rates table.
    // For now, if an exchange rate is provided, use it.
    if (data.exchangeRateToBase && data.exchangeRateToBase > 0) {
      balanceInBase = data.balanceOriginal * data.exchangeRateToBase;
    }
    // If account.currency IS the base currency (e.g. user.preferredCurrency), then balanceInBase = data.balanceOriginal.
    // This logic is simplified for now.

    const balanceEntry = await prisma.balanceEntry.create({
      data: {
        accountId: data.accountId,
        userId: session.user.id,
        entryDate: normalizedEntryDate,
        balanceOriginal: data.balanceOriginal,
        currency: data.currency.toUpperCase(),
        exchangeRateToBase: data.exchangeRateToBase,
        balanceInBase: balanceInBase,
        locked: data.locked,
        notes: data.notes,
      },
    });

    return NextResponse.json(balanceEntry, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    if (typeof error === 'object' && error !== null && 'code' in error) {
        if (error.code === 'P2002' && typeof error.meta === 'object' && error.meta !== null && 'target' in error.meta) {
            const metaTarget = error.meta.target;
            if (Array.isArray(metaTarget) && metaTarget.every(item => typeof item === 'string')) {
                const target = metaTarget as string[]; // Now safer
                if (target.includes('accountId') && target.includes('entryDate')) {
                    return NextResponse.json({ error: 'A balance entry for this account and month already exists.' }, { status: 409 });
                }
            }
        }
        if (error.code === 'P2003' && typeof error.meta === 'object' && error.meta !== null && 'field_name' in error.meta && String(error.meta.field_name).includes('accountId')) {
            return NextResponse.json({ error: 'Invalid Account ID.' }, { status: 400 });
        }
    }
    console.error("Error creating balance entry:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const accountId = searchParams.get('accountId');
  const startDateStr = searchParams.get('startDate');
  const endDateStr = searchParams.get('endDate');

  const whereClause: any = { userId: session.user.id };

  if (accountId) {
    if (accountId.length < 5) { // Basic sanity check for ID format, CUIDs are longer
        return NextResponse.json({ error: "Invalid Account ID format for filtering." }, { status: 400 });
    }
    const account = await prisma.account.findFirst({
        where: { id: accountId, userId: session.user.id }
    });
    if (!account) { // Account doesn't exist or doesn't belong to user
        return NextResponse.json({ error: "Account not found or access denied for filtering." }, { status: 404 });
    }
    whereClause.accountId = accountId;
  }

  if (startDateStr) {
    try {
        const date = normalizeToFirstOfMonthUTC(new Date(startDateStr));
        if (!isNaN(date.getTime())) {
            whereClause.entryDate = { ...whereClause.entryDate, gte: date };
        } else {
            return NextResponse.json({ error: "Invalid startDate format." }, { status: 400 });
        }
    } catch (_e) { return NextResponse.json({ error: "Invalid startDate." }, { status: 400 }); }
  }
  if (endDateStr) {
    try {
        const d = new Date(endDateStr);
        const nextMonthDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0, 0));
        if (!isNaN(nextMonthDate.getTime())) {
            whereClause.entryDate = { ...whereClause.entryDate, lt: nextMonthDate };
        } else {
            return NextResponse.json({ error: "Invalid endDate format." }, { status: 400 });
        }
    } catch (_e) { return NextResponse.json({ error: "Invalid endDate." }, { status: 400 }); }
  }

  try {
    const balanceEntries = await prisma.balanceEntry.findMany({
      where: whereClause,
      orderBy: [
        { accountId: 'asc' },
        { entryDate: 'desc' },
      ],
      include: {
        account: { select: { id: true, nickname: true, accountType: true, currency: true } },
      }
    });
    return NextResponse.json(balanceEntries);
  } catch (error) {
    console.error("Error fetching balance entries:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
