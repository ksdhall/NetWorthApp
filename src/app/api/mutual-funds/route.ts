import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Zod schema for creating a MutualFund
const createMutualFundSchema = z.object({
  fundName: z.string().min(1, "Fund name is required"),
  folioNumber: z.string().optional().nullable().transform(val => val === "" ? null : val),
  purchaseDate: z.preprocess((arg) => {
    if (typeof arg == "string" || arg instanceof Date) return new Date(arg);
    return undefined; // Let Zod handle if it's an error or becomes null/undefined for optional
  }, z.date().optional().nullable()),
  unitsHeld: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number({ required_error: "Units held is required" }).positive("Units held must be positive")
  ),
  averageCostPerUnit: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number({ required_error: "Average cost per unit is required" }).positive("Average cost must be positive")
  ),
  currentNAV: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? null : (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number().positive("Current NAV must be positive if provided").nullable().optional()
  ),
  currency: z.string().min(2, "Currency is required").max(10, "Currency code too long"),
  assetCategoryId: z.string().optional().nullable().transform(val => val === "" ? null : val),
  linkedAccountId: z.string().optional().nullable().transform(val => val === "" ? null : val),
  notes: z.string().optional().nullable().transform(val => val === "" ? null : val),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const json = await request.json();
    const data = createMutualFundSchema.parse(json);

    const mutualFund = await prisma.mutualFund.create({
      data: {
        userId: session.user.id,
        fundName: data.fundName,
        folioNumber: data.folioNumber,
        purchaseDate: data.purchaseDate,
        unitsHeld: data.unitsHeld,
        averageCostPerUnit: data.averageCostPerUnit,
        currentNAV: data.currentNAV,
        currency: data.currency.toUpperCase(),
        assetCategoryId: data.assetCategoryId,
        linkedAccountId: data.linkedAccountId,
        notes: data.notes,
      },
    });

    return NextResponse.json(mutualFund, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error creating mutual fund:", error);
    if (typeof error === 'object' && error !== null && 'code' in error) {
        if (error.code === 'P2003') {
            if (typeof error.meta === 'object' && error.meta !== null && 'field_name' in error.meta) {
                if (String(error.meta.field_name).includes('assetCategoryId')) {
                    return NextResponse.json({ error: 'Invalid Asset Category ID.' }, { status: 400 });
                }
                if (String(error.meta.field_name).includes('linkedAccountId')) {
                    return NextResponse.json({ error: 'Invalid Linked Account ID (e.g., Demat Account).' }, { status: 400 });
                }
            }
            return NextResponse.json({ error: 'Invalid related data ID provided.' }, { status: 400 });
        }
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(_request: Request) { // Renamed 'request' to '_request'
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const mutualFunds = await prisma.mutualFund.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        fundName: 'asc',
      },
      include: {
        assetCategory: { select: { id: true, name: true, type: true } },
        linkedAccount: { select: { id: true, nickname: true, accountType: true, bankName: true } },
      }
    });
    return NextResponse.json(mutualFunds);
  } catch (error) {
    console.error("Error fetching mutual funds:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
