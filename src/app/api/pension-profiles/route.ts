import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient, PensionCountry } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Zod schema for creating a PensionProfile
const createPensionProfileSchema = z.object({
  country: z.nativeEnum(PensionCountry),
  employerName: z.string().optional().nullable().transform(val => val === "" ? null : val),
  accountNumber: z.string().optional().nullable().transform(val => val === "" ? null : val),
  contributionToDate: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? null : (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number().positive("Contribution to date must be positive if provided").nullable().optional()
  ),
  employeeSharePercent: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? null : (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number().min(0, "Percentage cannot be negative").max(100, "Percentage cannot exceed 100").nullable().optional()
  ),
  employerSharePercent: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? null : (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number().min(0, "Percentage cannot be negative").max(100, "Percentage cannot exceed 100").nullable().optional() // Corrected min(0)
  ),
  projectedPayout: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? null : (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number().positive("Projected payout must be positive if provided").nullable().optional()
  ),
  assetCategoryId: z.string().optional().nullable().transform(val => val === "" ? null : val),
  notes: z.string().optional().nullable().transform(val => val === "" ? null : val),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const json = await request.json();
    const data = createPensionProfileSchema.parse(json);

    const pensionProfile = await prisma.pensionProfile.create({
      data: {
        userId: session.user.id,
        country: data.country,
        employerName: data.employerName,
        accountNumber: data.accountNumber,
        contributionToDate: data.contributionToDate,
        employeeSharePercent: data.employeeSharePercent,
        employerSharePercent: data.employerSharePercent,
        projectedPayout: data.projectedPayout,
        assetCategoryId: data.assetCategoryId,
        notes: data.notes,
      },
    });

    return NextResponse.json(pensionProfile, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error creating pension profile:", error);
    if (typeof error === 'object' && error !== null && 'code' in error) {
        if (error.code === 'P2003') {
            if (typeof error.meta === 'object' && error.meta !== null && 'field_name' in error.meta && String(error.meta.field_name).includes('assetCategoryId')) {
                return NextResponse.json({ error: 'Invalid Asset Category ID.' }, { status: 400 });
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
    const pensionProfiles = await prisma.pensionProfile.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: [
        { country: 'asc' },
        { employerName: 'asc' }
      ],
      include: {
        assetCategory: { select: { id: true, name: true, type: true } },
      }
    });
    return NextResponse.json(pensionProfiles);
  } catch (error) {
    console.error("Error fetching pension profiles:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
