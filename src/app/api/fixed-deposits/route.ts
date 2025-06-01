import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient, PayoutFrequency } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Zod schema for creating a FixedDeposit
const createFixedDepositSchema = z.object({
  bankName: z.string().min(1, "Bank name is required"),
  branch: z.string().optional().nullable().transform(val => val === "" ? null : val),
  fdAccountNumber: z.string().optional().nullable().transform(val => val === "" ? null : val),
  principalAmount: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number({ required_error: "Principal amount is required" }).positive("Principal amount must be positive")
  ),
  interestRate: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number({ required_error: "Interest rate is required" }).positive("Interest rate must be positive")
  ),
  startDate: z.preprocess((arg) => {
    if (typeof arg == "string" || arg instanceof Date) return new Date(arg);
    return undefined;
  }, z.date({ required_error: "Start date is required" })),
  maturityDate: z.preprocess((arg) => {
    if (typeof arg == "string" || arg instanceof Date) return new Date(arg);
    return undefined;
  }, z.date({ required_error: "Maturity date is required" })),
  payoutFrequency: z.nativeEnum(PayoutFrequency),
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
    const data = createFixedDepositSchema.parse(json);

    if (data.maturityDate <= data.startDate) {
      return NextResponse.json({ error: "Maturity date must be after start date." }, { status: 400 });
    }

    const fixedDeposit = await prisma.fixedDeposit.create({
      data: {
        userId: session.user.id,
        bankName: data.bankName,
        branch: data.branch,
        fdAccountNumber: data.fdAccountNumber,
        principalAmount: data.principalAmount,
        interestRate: data.interestRate,
        startDate: data.startDate,
        maturityDate: data.maturityDate,
        payoutFrequency: data.payoutFrequency,
        currency: data.currency.toUpperCase(),
        assetCategoryId: data.assetCategoryId,
        linkedAccountId: data.linkedAccountId,
        notes: data.notes,
      },
    });

    return NextResponse.json(fixedDeposit, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error creating fixed deposit:", error);
    if (typeof error === 'object' && error !== null && 'code' in error) {
        if (error.code === 'P2003') {
            if (typeof error.meta === 'object' && error.meta !== null && 'field_name' in error.meta) {
                if (String(error.meta.field_name).includes('assetCategoryId')) {
                    return NextResponse.json({ error: 'Invalid Asset Category ID.' }, { status: 400 });
                }
                if (String(error.meta.field_name).includes('linkedAccountId')) {
                    return NextResponse.json({ error: 'Invalid Linked Account ID.' }, { status: 400 });
                }
            }
            return NextResponse.json({ error: 'Invalid related data ID provided.' }, { status: 400 });
        }
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const fixedDeposits = await prisma.fixedDeposit.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        startDate: 'desc',
      },
      include: {
        assetCategory: { select: { id: true, name: true, type: true } },
        linkedAccount: { select: { id: true, nickname: true, accountType: true, bankName: true } },
      }
    });
    return NextResponse.json(fixedDeposits);
  } catch (error) {
    console.error("Error fetching fixed deposits:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
