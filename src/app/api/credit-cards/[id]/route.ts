import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient, CreditCardType } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Zod schema for updating a CreditCard (all fields optional)
const updateCreditCardSchema = z.object({
  nickname: z.string().min(1, "Nickname must be at least 1 character").optional(),
  cardType: z.nativeEnum(CreditCardType).optional(),
  lastFourDigits: z.string().length(4, "Last four digits must be exactly 4 characters").optional(),
  issuingBank: z.string().min(1, "Issuing bank must be at least 1 character").optional(),
  creditLimit: z.preprocess(
    (val) => (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number().positive("Credit limit must be positive")
  ).optional(),
  expiryDate: z.preprocess((arg) => {
    // If arg is explicitly empty string, null, or undefined, treat as 'not provided' for optional field.
    if (arg === "" || arg === null || arg === undefined) return undefined;
    if (typeof arg == "string" || arg instanceof Date) return new Date(arg);
    return undefined; // Let Zod handle if this is an error for an unparsable type
  }, z.date().optional()), // Expiry date itself is not nullable in schema, but field is optional for update
  billingAddressId: z.string().nullable().optional().transform(val => val === "" ? null : val),
  notes: z.string().nullable().optional(),
  assetCategoryId: z.string().nullable().optional().transform(val => val === "" ? null : val),
});

interface Params {
  id: string;
}

// GET /api/credit-cards/[id] - Get a specific credit card
export async function GET(request: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  try {
    const creditCard = await prisma.creditCard.findUnique({
      where: { id },
      include: {
        billingAddress: { select: { id: true, line1: true, city: true, country: true, type: true } },
        assetCategory: { select: { id: true, name: true, type: true } },
      }
    });

    if (!creditCard) {
      return NextResponse.json({ error: 'Credit card not found' }, { status: 404 });
    }

    if (creditCard.userId !== session.user.id) {
      return NextResponse.json({ error: 'Credit card not found' }, { status: 404 });
    }

    return NextResponse.json(creditCard);
  } catch (error) {
    console.error(`Error fetching credit card ${id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/credit-cards/[id] - Update a specific credit card
export async function PUT(request: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  try {
    const json = await request.json();
    const data = updateCreditCardSchema.parse(json);

    // Prisma handles undefined fields as "no change"
    const updatedCreditCard = await prisma.creditCard.update({
      where: {
        id: id,
        userId: session.user.id, // Ensure user owns the card they are trying to update
      },
      data: data, // Pass validated data (with potential undefined fields for no-change)
    });

    return NextResponse.json(updatedCreditCard);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    if (typeof error === 'object' && error !== null && 'code' in error) {
        if (error.code === 'P2025') { // Record to update not found (or userId didn't match)
            return NextResponse.json({ error: 'Credit card not found or access denied' }, { status: 404 });
        }
        if (error.code === 'P2003') {
            if (typeof error.meta === 'object' && error.meta !== null && 'field_name' in error.meta) {
                if (String(error.meta.field_name).includes('billingAddressId')) {
                    return NextResponse.json({ error: 'Invalid Billing Address ID provided.' }, { status: 400 });
                }
                if (String(error.meta.field_name).includes('assetCategoryId')) {
                    return NextResponse.json({ error: 'Invalid Asset Category ID provided.' }, { status: 400 });
                }
            }
             return NextResponse.json({ error: 'Invalid related data ID provided.' }, { status: 400 });
        }
    }
    console.error(`Error updating credit card ${id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/credit-cards/[id] - Delete a specific credit card
export async function DELETE(request: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  try {
    const deleteResult = await prisma.creditCard.deleteMany({
      where: {
        id: id,
        userId: session.user.id, // Ensures only the owner can delete
      },
    });

    if (deleteResult.count === 0) {
      return NextResponse.json({ error: 'Credit card not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Credit card deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting credit card ${id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
