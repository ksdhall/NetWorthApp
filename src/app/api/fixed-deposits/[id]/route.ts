import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient, PayoutFrequency } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Zod schema for updating a FixedDeposit (all fields optional)
const updateFixedDepositSchema = z.object({
  bankName: z.string().min(1, "Bank name must be at least 1 character").optional(),
  branch: z.string().nullable().optional().transform(val => val === "" ? null : val),
  fdAccountNumber: z.string().nullable().optional().transform(val => val === "" ? null : val),
  principalAmount: z.preprocess(
    (val) => (val === undefined || val === null || val === '') ? undefined : (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number().positive("Principal amount must be positive if provided")
  ).optional(),
  interestRate: z.preprocess(
    (val) => (val === undefined || val === null || val === '') ? undefined : (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number().positive("Interest rate must be positive if provided")
  ).optional(),
  startDate: z.preprocess((arg) => {
    if (arg === "" || arg === null || arg === undefined) return undefined;
    if (typeof arg == "string" || arg instanceof Date) return new Date(arg);
    return undefined;
  }, z.date().optional()),
  maturityDate: z.preprocess((arg) => {
    if (arg === "" || arg === null || arg === undefined) return undefined;
    if (typeof arg == "string" || arg instanceof Date) return new Date(arg);
    return undefined;
  }, z.date().optional()),
  payoutFrequency: z.nativeEnum(PayoutFrequency).optional(),
  currency: z.string().min(2, "Currency must be at least 2 characters").max(10, "Currency code too long").optional(),
  assetCategoryId: z.string().nullable().optional().transform(val => val === "" ? null : val),
  linkedAccountId: z.string().nullable().optional().transform(val => val === "" ? null : val),
  notes: z.string().nullable().optional().transform(val => val === "" ? null : val),
}).refine(data => {
    // This refine check is for when both dates are present in the *update* payload.
    // More comprehensive check including existing dates is done in the PUT handler.
    if (data.startDate && data.maturityDate) {
        return data.maturityDate > data.startDate;
    }
    return true;
}, {
    message: "Maturity date must be after start date if both are being updated.",
    path: ["maturityDate"],
});


interface Params {
  id: string;
}

// GET /api/fixed-deposits/[id]
export async function GET(request: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = params;
  try {
    const fixedDeposit = await prisma.fixedDeposit.findUnique({
      where: { id },
      include: {
        assetCategory: { select: { id: true, name: true, type: true } },
        linkedAccount: { select: { id: true, nickname: true, accountType: true, bankName: true } },
      }
    });
    if (!fixedDeposit || fixedDeposit.userId !== session.user.id) {
      return NextResponse.json({ error: 'Fixed deposit not found' }, { status: 404 });
    }
    return NextResponse.json(fixedDeposit);
  } catch (error) {
    console.error(`Error fetching fixed deposit ${id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/fixed-deposits/[id]
export async function PUT(request: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = params;
  try {
    const json = await request.json();
    const data = updateFixedDepositSchema.parse(json);

    // Fetch existing record to verify ownership and for date comparison
    const existingFixedDeposit = await prisma.fixedDeposit.findFirst({
        where: { id: id, userId: session.user.id }
    });
    if (!existingFixedDeposit) {
      return NextResponse.json({ error: 'Fixed deposit not found or access denied' }, { status: 404 });
    }

    const updateData = { ...data }; // Changed let to const
    if (updateData.currency) {
      updateData.currency = updateData.currency.toUpperCase();
    }

    // Date validation: if one date is provided, use existing for the other to compare
    const finalStartDate = data.startDate || existingFixedDeposit.startDate;
    const finalMaturityDate = data.maturityDate || existingFixedDeposit.maturityDate;

    if (finalMaturityDate <= finalStartDate) {
        return NextResponse.json({ error: "Maturity date must be after start date." }, { status: 400 });
    }
    // Update data might contain undefined for dates if not provided; Prisma handles this as no-change
    updateData.startDate = data.startDate;
    updateData.maturityDate = data.maturityDate;


    const updatedFixedDeposit = await prisma.fixedDeposit.update({
      where: {
        id: id,
        // userId: session.user.id, // Already confirmed ownership with findFirst
      },
      data: updateData,
    });
    return NextResponse.json(updatedFixedDeposit);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    if (typeof error === 'object' && error !== null && 'code' in error) {
        if (error.code === 'P2025') {
            return NextResponse.json({ error: 'Fixed deposit not found' }, { status: 404 });
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
    console.error(`Error updating fixed deposit ${id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/fixed-deposits/[id]
export async function DELETE(request: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = params;
  try {
    const deleteResult = await prisma.fixedDeposit.deleteMany({
      where: {
        id: id,
        userId: session.user.id, // Ensures only the owner can delete
      },
    });

    if (deleteResult.count === 0) {
      return NextResponse.json({ error: 'Fixed deposit not found or access denied' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Fixed deposit deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting fixed deposit ${id}:`, error);
    // P2025 should be caught by deleteResult.count check
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
