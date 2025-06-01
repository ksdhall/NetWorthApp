import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adjust path as necessary
import { PrismaClient, AddressType } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Zod schema for creating an AddressHistory
const createAddressSchema = z.object({
  type: z.nativeEnum(AddressType),
  line1: z.string().min(1, "Address line 1 is required"),
  line2: z.string().optional().nullable(),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  postalCode: z.string().min(1, "Postal code is required"),
  country: z.string().min(1, "Country is required"),
  fromDate: z.preprocess((arg) => {
    if (typeof arg == "string" || arg instanceof Date) return new Date(arg);
    return null; // Should ideally not happen if required, but good for robustness
  }, z.date()), // fromDate is required
  toDate: z.preprocess((arg) => {
    if (arg === "" || arg === null || arg === undefined) return null;
    if (typeof arg == "string" || arg instanceof Date) return new Date(arg);
    return undefined; // Let Zod handle if it's not a valid date precursor for optional field
  }, z.date().optional().nullable()),
  isCurrent: z.boolean().optional().default(false),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const json = await request.json();
    const data = createAddressSchema.parse(json);

    // Optional: If isCurrent is true, set other addresses for this user to not current.
    if (data.isCurrent) {
      await prisma.addressHistory.updateMany({
        where: {
          userId: session.user.id,
          isCurrent: true,
        },
        data: { isCurrent: false },
      });
    }

    const address = await prisma.addressHistory.create({
      data: {
        userId: session.user.id,
        type: data.type,
        line1: data.line1,
        line2: data.line2,
        city: data.city,
        state: data.state,
        postalCode: data.postalCode,
        country: data.country,
        fromDate: data.fromDate,
        toDate: data.toDate,
        isCurrent: data.isCurrent,
        latitude: data.latitude,
        longitude: data.longitude,
      },
    });

    return NextResponse.json(address, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error creating address:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const addresses = await prisma.addressHistory.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: [
        { isCurrent: 'desc' }, // Show current address first
        { fromDate: 'desc' },   // Then by most recent fromDate
      ],
    });
    return NextResponse.json(addresses);
  } catch (error) {
    console.error("Error fetching addresses:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
