import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient, CreditCardType } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Zod schema for creating a CreditCard
const createCreditCardSchema = z.object({
  nickname: z.string().min(1, "Nickname is required"),
  cardType: z.nativeEnum(CreditCardType),
  lastFourDigits: z.string().length(4, "Last four digits must be exactly 4 characters"),
  issuingBank: z.string().min(1, "Issuing bank is required"),
  creditLimit: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number({ required_error: "Credit limit is required" }).positive("Credit limit must be positive")
  ),
  expiryDate: z.preprocess((arg) => {
    if (typeof arg == "string" || arg instanceof Date) return new Date(arg);
    return undefined; // Let Zod handle if it's not a valid date string or undefined
  }, z.date({ required_error: "Expiry date is required" })),
  // Assuming CUIDs for related IDs, which are strings. Prisma's default CUID is 25 chars.
  // Zod's .uuid() is for standard UUID format. For CUIDs, a string check is usually sufficient.
  billingAddressId: z.string().optional().nullable().transform(val => val === "" ? null : val),
  notes: z.string().optional().nullable(),
  assetCategoryId: z.string().optional().nullable().transform(val => val === "" ? null : val),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const json = await request.json();
    const data = createCreditCardSchema.parse(json);

    const creditCard = await prisma.creditCard.create({
      data: {
        userId: session.user.id,
        nickname: data.nickname,
        cardType: data.cardType,
        lastFourDigits: data.lastFourDigits,
        issuingBank: data.issuingBank,
        creditLimit: data.creditLimit,
        expiryDate: data.expiryDate,
        billingAddressId: data.billingAddressId,
        notes: data.notes,
        assetCategoryId: data.assetCategoryId,
      },
    });

    return NextResponse.json(creditCard, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error creating credit card:", error);
    if (typeof error === 'object' && error !== null && 'code' in error) {
        if (error.code === 'P2003') { // Foreign key constraint failed
            if (typeof error.meta === 'object' && error.meta !== null && 'field_name' in error.meta) {
                if (String(error.meta.field_name).includes('billingAddressId')) {
                    return NextResponse.json({ error: 'Invalid Billing Address ID.' }, { status: 400 });
                }
                if (String(error.meta.field_name).includes('assetCategoryId')) {
                    return NextResponse.json({ error: 'Invalid Asset Category ID.' }, { status: 400 });
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
    const creditCards = await prisma.creditCard.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        nickname: 'asc',
      },
      include: {
        billingAddress: { select: { id: true, line1: true, city: true, country: true } },
        assetCategory: { select: { id: true, name: true, type: true } },
      }
    });
    return NextResponse.json(creditCards);
  } catch (error) {
    console.error("Error fetching credit cards:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
