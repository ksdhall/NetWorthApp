import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient, AccountType } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Zod schema for updating a Financial Account (all fields optional)
const updateAccountSchema = z.object({
  nickname: z.string().min(1, "Nickname must be at least 1 character").optional(),
  accountType: z.nativeEnum(AccountType).optional(),
  currency: z.string().min(2, "Currency code must be at least 2 characters").max(10, "Currency code too long").optional(),
  bankName: z.string().nullable().optional(),
  branch: z.string().nullable().optional(),
  accountNumberEncrypted: z.string().nullable().optional(),
  ifscSwift: z.string().nullable().optional(),
  linkedAddressId: z.string().nullable().optional(),
  linkedPhoneNumber: z.string().nullable().optional(),
  onlineLoginUsernameEncrypted: z.string().nullable().optional(),
  onlineLoginPasswordEncrypted: z.string().nullable().optional(),
  twoFactorMethod: z.string().nullable().optional(),
  assetCategoryId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

interface Params {
  id: string;
}

// GET /api/accounts/[id] - Get a specific financial account
export async function GET(request: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  try {
    const account = await prisma.account.findUnique({
      where: { id: id }, // Ensure correct ID format if not CUID/UUID by default
      include: { // Optionally include related data for detail view
        assetCategory: { select: { id: true, name: true, type: true } },
        linkedAddress: true, // Include full address details
      }
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    if (account.userId !== session.user.id) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 }); // Privacy
    }

    return NextResponse.json(account);
  } catch (error) {
    console.error(`Error fetching account ${id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/accounts/[id] - Update a specific financial account
export async function PUT(request: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  try {
    const json = await request.json();
    const data = updateAccountSchema.parse(json);

    const updateData = { ...data }; // Changed let to const
    if (updateData.currency) {
      updateData.currency = updateData.currency.toUpperCase();
    }

    // Prisma handles undefined fields correctly (as no-change), so no need to delete them.
    // Explicit nulls from Zod schema (e.g. .nullable()) will be passed to Prisma to set fields to NULL.

    const updatedAccount = await prisma.account.update({
      where: {
        id: id,
        userId: session.user.id, // Ensures user can only update their own accounts
      },
      data: updateData,
    });

    return NextResponse.json(updatedAccount);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    if (typeof error === 'object' && error !== null && 'code' in error) {
        if (error.code === 'P2025') { // Record to update not found (or userId didn't match)
            return NextResponse.json({ error: 'Account not found or access denied' }, { status: 404 });
        }
        if (error.code === 'P2003') { // Foreign key constraint failed
            if (typeof error.meta === 'object' && error.meta !== null && 'field_name' in error.meta) {
                if (String(error.meta.field_name).includes('assetCategoryId')) {
                    return NextResponse.json({ error: 'Invalid Asset Category ID provided.' }, { status: 400 });
                }
                if (String(error.meta.field_name).includes('linkedAddressId')) {
                    return NextResponse.json({ error: 'Invalid Linked Address ID provided.' }, { status: 400 });
                }
            }
            return NextResponse.json({ error: 'Invalid related data ID provided.' }, { status: 400 });
        }
    }
    console.error(`Error updating account ${id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/accounts/[id] - Delete a specific financial account
export async function DELETE(request: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  try {
    const deleteResult = await prisma.account.deleteMany({
      where: {
        id: id,
        userId: session.user.id, // Ensures only the owner can delete
      },
    });

    if (deleteResult.count === 0) {
      return NextResponse.json({ error: 'Account not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Account deleted successfully' }, { status: 200 });
  } catch (error) {
    // P2025 for deleteMany means no records matched the where clause.
    // This is handled by deleteResult.count === 0.
    // P2003 (foreign key constraint) might occur if, for example, BalanceEntry had a non-optional
    // relation to Account and onDelete was not set to Cascade.
    // Given current schema (BalanceEntry onDelete: Cascade), this is less likely for BalanceEntry.
    console.error(`Error deleting account ${id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
