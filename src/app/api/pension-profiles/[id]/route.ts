import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient, PensionCountry } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Zod schema for updating a PensionProfile (all fields optional)
const updatePensionProfileSchema = z.object({
  country: z.nativeEnum(PensionCountry).optional(),
  employerName: z.string().nullable().optional().transform(val => val === "" ? null : val),
  accountNumber: z.string().nullable().optional().transform(val => val === "" ? null : val),
  contributionToDate: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? undefined : // Keep undefined if not provided to not update
               (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number().positive("Contribution to date must be positive if provided").nullable().optional()
  ),
  employeeSharePercent: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? undefined :
               (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number().min(0, "Percentage cannot be negative").max(100, "Percentage cannot exceed 100").nullable().optional()
  ),
  employerSharePercent: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? undefined :
               (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number().min(0,"Percentage cannot be negative").max(100, "Percentage cannot exceed 100").nullable().optional()
  ),
  projectedPayout: z.preprocess(
    (val) => (val === '' || val === null || val === undefined) ? undefined :
               (typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : typeof val === 'number' ? val : undefined),
    z.number().positive("Projected payout must be positive if provided").nullable().optional()
  ),
  assetCategoryId: z.string().nullable().optional().transform(val => val === "" ? null : val),
  notes: z.string().nullable().optional().transform(val => val === "" ? null : val),
});

interface Params {
  id: string;
}

// GET /api/pension-profiles/[id]
export async function GET(request: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = params;
  try {
    const pensionProfile = await prisma.pensionProfile.findUnique({
      where: { id },
      include: {
        assetCategory: { select: { id: true, name: true, type: true } },
      }
    });
    if (!pensionProfile || pensionProfile.userId !== session.user.id) {
      return NextResponse.json({ error: 'Pension profile not found' }, { status: 404 });
    }
    return NextResponse.json(pensionProfile);
  } catch (error) {
    console.error(`Error fetching pension profile ${id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/pension-profiles/[id]
export async function PUT(request: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = params;
  try {
    const json = await request.json();
    const data = updatePensionProfileSchema.parse(json);

    // Prisma handles undefined fields as "no change"
    const updatedProfile = await prisma.pensionProfile.update({
      where: {
        id: id,
        userId: session.user.id, // Ensures user owns the record
       },
      data: data,
    });
    return NextResponse.json(updatedProfile);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    if (typeof error === 'object' && error !== null && 'code' in error) {
        if (error.code === 'P2025') {
            return NextResponse.json({ error: 'Pension profile not found or access denied' }, { status: 404 });
        }
        if (error.code === 'P2003' && typeof error.meta === 'object' && error.meta !== null && 'field_name' in error.meta && String(error.meta.field_name).includes('assetCategoryId')) {
            return NextResponse.json({ error: 'Invalid Asset Category ID.' }, { status: 400 });
        }
    }
    console.error(`Error updating pension profile ${id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/pension-profiles/[id]
export async function DELETE(request: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = params;
  try {
    const deleteResult = await prisma.pensionProfile.deleteMany({
      where: {
        id: id,
        userId: session.user.id, // Ensures only the owner can delete
      },
    });

    if (deleteResult.count === 0) {
      return NextResponse.json({ error: 'Pension profile not found or access denied' }, { status: 404 });
    }
    return NextResponse.json({ message: 'Pension profile deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting pension profile ${id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
