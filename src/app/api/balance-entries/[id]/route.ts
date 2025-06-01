import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient, Prisma } from '@prisma/client'; // Added Prisma
import { z } from 'zod';

const prisma = new PrismaClient();

// Note: normalizeToFirstOfMonthUTC is not used here as entryDate is not updatable.

// Zod schema for updating a BalanceEntry
// accountId and entryDate are part of the unique key and typically should not be changed.
// Currency is tied to the account and should not change here.
const updateBalanceEntrySchema = z.object({
  balanceOriginal: z.preprocess(
    (val) => (val === undefined || val === null || val === '') ? undefined : (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number() // Can be negative for liabilities like credit cards
  ).optional(),
  exchangeRateToBase: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? null : (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number().positive("Exchange rate must be positive if provided").nullable().optional()
  ),
  notes: z.string().nullable().optional().transform(val => val === "" ? null : val),
  locked: z.boolean().optional(),
});

// Separate schema for updating only lock status or notes, if entry is locked
const updateLockedBalanceEntrySchema = z.object({
    notes: z.string().nullable().optional().transform(val => val === "" ? null : val),
    locked: z.boolean().optional(),
});


interface Params {
  id: string;
}

// GET /api/balance-entries/[id]
export async function GET(request: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = params;
  try {
    const balanceEntry = await prisma.balanceEntry.findUnique({
      where: { id },
      // Include account to verify ownership and provide context
      include: { account: { select: { id: true, nickname: true, currency: true, userId: true } } }
    });

    if (!balanceEntry) {
      return NextResponse.json({ error: 'Balance entry not found' }, { status: 404 });
    }
    // Verify ownership through the account's userId
    if (balanceEntry.account.userId !== session.user.id) {
         return NextResponse.json({ error: 'Balance entry not found' }, { status: 404 }); // Mask as not found
    }

    // Omit account.userId from response for client
    const { account, ...entryData } = balanceEntry;
    const responseData = {
        ...entryData,
        account: {
            id: account.id,
            nickname: account.nickname,
            currency: account.currency
        }
    };
    return NextResponse.json(responseData);
  } catch (error) {
    console.error(`Error fetching balance entry ${id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/balance-entries/[id]
export async function PUT(request: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = params;
  try {
    const existingEntry = await prisma.balanceEntry.findFirst({ // Use findFirst with userId
      where: {
        id: id,
        userId: session.user.id // Direct ownership check on BalanceEntry
      },
      include: { account: { select: { currency: true } } } // Still need account currency for validation if currency not on BalanceEntry
    });

    if (!existingEntry) {
      return NextResponse.json({ error: 'Balance entry not found or access denied' }, { status: 404 });
    }

    const json = await request.json();
    let dataToUpdate: Prisma.BalanceEntryUpdateInput;

    if (existingEntry.locked) {
        const validationResult = updateLockedBalanceEntrySchema.safeParse(json);
        if (!validationResult.success) {
            return NextResponse.json({ error: "Entry is locked. Only notes and lock status can be updated.", details: validationResult.error.errors }, { status: 403 });
        }
        dataToUpdate = validationResult.data;
        // Ensure only allowed fields are passed if others were somehow included
        dataToUpdate = {
            notes: dataToUpdate.notes,
            locked: dataToUpdate.locked
        };
    } else {
        const validationResult = updateBalanceEntrySchema.safeParse(json);
        if (!validationResult.success) {
            return NextResponse.json({ error: validationResult.error.errors }, { status: 400 });
        }
        dataToUpdate = validationResult.data;

        let balanceInBase: number | null = existingEntry.balanceInBase;
        const newBalanceOriginal = dataToUpdate.balanceOriginal !== undefined ? dataToUpdate.balanceOriginal : existingEntry.balanceOriginal;
        const newExchangeRate = dataToUpdate.exchangeRateToBase !== undefined ? dataToUpdate.exchangeRateToBase : existingEntry.exchangeRateToBase;

        if (dataToUpdate.balanceOriginal !== undefined || dataToUpdate.exchangeRateToBase !== undefined) {
            if (newExchangeRate && newExchangeRate > 0) {
                balanceInBase = newBalanceOriginal * newExchangeRate;
            } else {
                // If rate becomes null/0, or was already null/0, and balanceOriginal changes
                // set balanceInBase to original. (Assumes original currency IS base or no conversion needed)
                balanceInBase = newBalanceOriginal;
            }
        }
        dataToUpdate.balanceInBase = balanceInBase;
    }

    // Prisma handles undefined fields as "no change"
    const updatedEntry = await prisma.balanceEntry.update({
      where: {
        id: id,
        // userId: session.user.id, // Already confirmed by findFirst with userId
      },
      data: dataToUpdate,
    });
    return NextResponse.json(updatedEntry);

  } catch (error) {
    if (error instanceof z.ZodError) { // This might be redundant if caught by safeParse
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
         return NextResponse.json({ error: 'Balance entry not found' }, { status: 404 });
    }
    console.error(`Error updating balance entry ${id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/balance-entries/[id]
export async function DELETE(request: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = params;
  try {
    // Check ownership and locked status before deleting
    const entry = await prisma.balanceEntry.findFirst({
        where: { id: id, userId: session.user.id }
    });

    if (!entry) {
      return NextResponse.json({ error: 'Balance entry not found or access denied' }, { status: 404 });
    }

    // Optional: Prevent deletion of locked entries
    // if (entry.locked) {
    //   return NextResponse.json({ error: 'Cannot delete a locked balance entry. Unlock it first.' }, { status: 403 });
    // }

    await prisma.balanceEntry.delete({
        where: { id: id } // id is unique, ownership confirmed
    });
    return NextResponse.json({ message: 'Balance entry deleted successfully' }, { status: 200 });
  } catch (error) {
     if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
        return NextResponse.json({ error: 'Balance entry not found' }, { status: 404 });
    }
    console.error(`Error deleting balance entry ${id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
