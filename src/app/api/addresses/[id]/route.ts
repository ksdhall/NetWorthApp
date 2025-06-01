import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adjust path as necessary
import { PrismaClient, AddressType } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Zod schema for updating an AddressHistory (all fields optional)
const updateAddressSchema = z.object({
  type: z.nativeEnum(AddressType).optional(),
  line1: z.string().min(1, "Address line 1 must be at least 1 character").optional(),
  line2: z.string().nullable().optional(), // Allows null or string
  city: z.string().min(1, "City must be at least 1 character").optional(),
  state: z.string().min(1, "State must be at least 1 character").optional(),
  postalCode: z.string().min(1, "Postal code must be at least 1 character").optional(),
  country: z.string().min(1, "Country must be at least 1 character").optional(),
  fromDate: z.preprocess((arg) => {
    // If arg is explicitly empty string, null, or undefined, treat as 'not provided' for optional field.
    // Zod's .optional() will handle it. If it's a date string/object, convert.
    if (arg === "" || arg === null || arg === undefined) return undefined;
    if (typeof arg == "string" || arg instanceof Date) return new Date(arg);
    return undefined; // Let Zod decide if this is an error for an unparsable type
  }, z.date().optional()), // fromDate is optional for updates
  toDate: z.preprocess((arg) => {
    if (arg === "" || arg === null || arg === undefined) return null; // Allow explicit nullification
    if (typeof arg == "string" || arg instanceof Date) return new Date(arg);
    return undefined; // Let Zod decide
  }, z.date().nullable().optional()),
  isCurrent: z.boolean().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
});

interface Params {
  id: string;
}

// GET /api/addresses/[id] - Get a specific address
export async function GET(request: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  try {
    const address = await prisma.addressHistory.findUnique({
      where: { id },
    });

    if (!address) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }

    if (address.userId !== session.user.id) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 }); // Privacy: don't reveal existence
    }

    return NextResponse.json(address);
  } catch (error) {
    console.error(`Error fetching address ${id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/addresses/[id] - Update a specific address
export async function PUT(request: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  try {
    const json = await request.json();
    const data = updateAddressSchema.parse(json);

    // If isCurrent is being set to true, ensure other addresses for this user are set to not current
    if (data.isCurrent === true) {
        // Check the existing value first to avoid unnecessary db write if it's already current
        const existingAddress = await prisma.addressHistory.findFirst({
            where: { id: id, userId: session.user.id }
        });
        if (!existingAddress) {
            return NextResponse.json({ error: 'Address not found' }, { status: 404 });
        }
        if (!existingAddress.isCurrent) { // Only run if changing from false to true
            await prisma.addressHistory.updateMany({
                where: {
                    userId: session.user.id,
                    isCurrent: true,
                    id: { not: id } // Don't update the current one being set
                },
                data: { isCurrent: false },
            });
        }
    }

    // Prisma handles undefined fields in `data` as "no change"
    const updatedAddress = await prisma.addressHistory.update({
      where: {
        id: id,
        userId: session.user.id, // Ensures user can only update their own addresses
      },
      data: data,
    });

    return NextResponse.json(updatedAddress);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    if (error.code === 'P2025') { // Prisma specific error: "Record to update not found."
        return NextResponse.json({ error: 'Address not found or access denied' }, { status: 404 });
    }
    console.error(`Error updating address ${id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/addresses/[id] - Delete a specific address
export async function DELETE(request: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  try {
    const deleteResult = await prisma.addressHistory.deleteMany({
      where: {
        id: id,
        userId: session.user.id, // Ensures only the owner can delete
      },
    });

    if (deleteResult.count === 0) {
      // This means either the document didn't exist or it didn't belong to the user.
      return NextResponse.json({ error: 'Address not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Address deleted successfully' }, { status: 200 });
  } catch (error) {
    // P2025 can also be thrown by deleteMany if the where clause doesn't match any records.
    // This is already handled by the deleteResult.count check.
    console.error(`Error deleting address ${id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
