import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient, AccountType } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Zod schema for creating a Financial Account (Core Fields)
const createAccountSchema = z.object({
  nickname: z.string().min(1, "Nickname is required"),
  accountType: z.nativeEnum(AccountType),
  currency: z.string().min(2, "Currency code is required (e.g., USD, EUR, INR)").max(10, "Currency code too long"),
  bankName: z.string().optional().nullable(),
  branch: z.string().optional().nullable(),
  accountNumberEncrypted: z.string().optional().nullable(),
  ifscSwift: z.string().optional().nullable(),
  // Assuming CUIDs for related IDs, which are string. Prisma's default CUID is 25 chars.
  // Zod's .uuid() is for standard UUID format. For CUIDs, a string check is usually sufficient,
  // or a regex if specific format needs enforcement: .string().regex(/^[a-z0-9]{25}$/)
  linkedAddressId: z.string().optional().nullable(),
  linkedPhoneNumber: z.string().optional().nullable(),
  onlineLoginUsernameEncrypted: z.string().optional().nullable(),
  onlineLoginPasswordEncrypted: z.string().optional().nullable(),
  twoFactorMethod: z.string().optional().nullable(),
  assetCategoryId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const json = await request.json();
    const data = createAccountSchema.parse(json);

    const account = await prisma.account.create({
      data: {
        userId: session.user.id,
        nickname: data.nickname,
        accountType: data.accountType,
        currency: data.currency.toUpperCase(), // Store currency codes in uppercase
        bankName: data.bankName,
        branch: data.branch,
        accountNumberEncrypted: data.accountNumberEncrypted,
        ifscSwift: data.ifscSwift,
        linkedAddressId: data.linkedAddressId,
        linkedPhoneNumber: data.linkedPhoneNumber,
        onlineLoginUsernameEncrypted: data.onlineLoginUsernameEncrypted,
        onlineLoginPasswordEncrypted: data.onlineLoginPasswordEncrypted,
        twoFactorMethod: data.twoFactorMethod,
        assetCategoryId: data.assetCategoryId,
        notes: data.notes,
      },
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error creating financial account:", error);
    // Check for Prisma specific error codes
    if (typeof error === 'object' && error !== null && 'code' in error) {
        if (error.code === 'P2003') { // Foreign key constraint failed
            // The error.meta.field_name might not be available or different based on Prisma version
            // For now, a generic message for P2003 or checking specific fields.
            if (typeof error.meta === 'object' && error.meta !== null && 'field_name' in error.meta) {
                 if (String(error.meta.field_name).includes('assetCategoryId')) {
                    return NextResponse.json({ error: 'Invalid Asset Category ID.' }, { status: 400 });
                }
                if (String(error.meta.field_name).includes('linkedAddressId')) {
                    return NextResponse.json({ error: 'Invalid Linked Address ID.' }, { status: 400 });
                }
            }
            return NextResponse.json({ error: 'Invalid related data provided (e.g., Address or Category ID).' }, { status: 400 });
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
    const accounts = await prisma.account.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        nickname: 'asc',
      },
      include: { // Include related data for richer list display if needed on client
        assetCategory: { select: { id: true, name: true, type: true } },
        linkedAddress: { select: { id: true, line1: true, city: true, country: true } },
      }
    });
    return NextResponse.json(accounts);
  } catch (error) {
    console.error("Error fetching financial accounts:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
