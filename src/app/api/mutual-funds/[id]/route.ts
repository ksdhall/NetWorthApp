import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Zod schema for updating a MutualFund (all fields optional)
const updateMutualFundSchema = z.object({
  fundName: z.string().min(1, "Fund name must be at least 1 character").optional(),
  folioNumber: z.string().nullable().optional().transform(val => val === "" ? null : val),
  purchaseDate: z.preprocess((arg) => {
    if (arg === "" || arg === null || arg === undefined) return undefined;
    if (typeof arg == "string" || arg instanceof Date) return new Date(arg);
    return undefined; // Let Zod handle if this is an error for an unparsable type
  }, z.date().nullable().optional()),
  unitsHeld: z.preprocess(
    (val) => (val === undefined || val === null || val === '') ? undefined : (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number().positive("Units held must be positive if provided")
  ).optional(),
  averageCostPerUnit: z.preprocess(
    (val) => (val === undefined || val === null || val === '') ? undefined : (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number().positive("Average cost must be positive if provided")
  ).optional(),
  currentNAV: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? null : (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number().positive("Current NAV must be positive if provided").nullable().optional()
  ),
  currency: z.string().min(2, "Currency must be at least 2 characters").max(10, "Currency code too long").optional(),
  assetCategoryId: z.string().nullable().optional().transform(val => val === "" ? null : val),
  linkedAccountId: z.string().nullable().optional().transform(val => val === "" ? null : val),
  notes: z.string().nullable().optional().transform(val => val === "" ? null : val),
});

interface Params {
  id: string;
}

// GET /api/mutual-funds/[id] - Get a specific mutual fund
export async function GET(request: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  try {
    const mutualFund = await prisma.mutualFund.findUnique({
      where: { id },
      include: {
        assetCategory: { select: { id: true, name: true, type: true } },
        linkedAccount: { select: { id: true, nickname: true, accountType: true, bankName: true } },
      }
    });

    if (!mutualFund) {
      return NextResponse.json({ error: 'Mutual fund not found' }, { status: 404 });
    }

    if (mutualFund.userId !== session.user.id) {
      return NextResponse.json({ error: 'Mutual fund not found' }, { status: 404 });
    }

    return NextResponse.json(mutualFund);
  } catch (error) {
    console.error(`Error fetching mutual fund ${id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/mutual-funds/[id] - Update a specific mutual fund
export async function PUT(request: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  try {
    const json = await request.json();
    const data = updateMutualFundSchema.parse(json);

    const updateData = { ...data }; // Changed let to const
    if (updateData.currency) {
      updateData.currency = updateData.currency.toUpperCase();
    }
    // Prisma handles undefined fields as "no change"

    const updatedMutualFund = await prisma.mutualFund.update({
      where: {
        id: id,
        userId: session.user.id, // Ensure user owns the record they are trying to update
      },
      data: updateData,
    });

    return NextResponse.json(updatedMutualFund);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    if (typeof error === 'object' && error !== null && 'code' in error) {
        if (error.code === 'P2025') { // Record to update not found (or userId didn't match)
            return NextResponse.json({ error: 'Mutual fund not found or access denied' }, { status: 404 });
        }
        if (error.code === 'P2003') {
            if (typeof error.meta === 'object' && error.meta !== null && 'field_name' in error.meta) {
                if (String(error.meta.field_name).includes('assetCategoryId')) {
                    return NextResponse.json({ error: 'Invalid Asset Category ID provided.' }, { status: 400 });
                }
                if (String(error.meta.field_name).includes('linkedAccountId')) {
                    return NextResponse.json({ error: 'Invalid Linked Account ID provided.' }, { status: 400 });
                }
            }
            return NextResponse.json({ error: 'Invalid related data ID provided.' }, { status: 400 });
        }
    }
    console.error(`Error updating mutual fund ${id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/mutual-funds/[id] - Delete a specific mutual fund
export async function DELETE(request: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  try {
    const deleteResult = await prisma.mutualFund.deleteMany({
      where: {
        id: id,
        userId: session.user.id, // Ensures only the owner can delete
      },
    });

    if (deleteResult.count === 0) {
      return NextResponse.json({ error: 'Mutual fund not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Mutual fund deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting mutual fund ${id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
