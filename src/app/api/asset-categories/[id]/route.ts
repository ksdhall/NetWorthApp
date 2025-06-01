import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient, AssetType } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Zod schema for updating an AssetCategory (all fields optional)
const updateAssetCategorySchema = z.object({
  name: z.string().min(1, "Category name must be at least 1 character").optional(),
  type: z.nativeEnum(AssetType).optional(),
  // Allow null to remove parent, or string for CUID. Transform empty string to null.
  parentCategoryId: z.string().nullable().optional().transform(val => val === "" ? null : val),
});

interface Params {
  id: string;
}

// GET /api/asset-categories/[id] - Get a specific asset category
export async function GET(request: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  try {
    const assetCategory = await prisma.assetCategory.findUnique({
      where: { id },
      include: { // Provide context for editing if needed
        parentCategory: { select: { id: true, name: true } },
        subCategories: { select: { id: true, name: true } },
      }
    });

    if (!assetCategory) {
      return NextResponse.json({ error: 'Asset category not found' }, { status: 404 });
    }

    return NextResponse.json(assetCategory);
  } catch (error) {
    console.error(`Error fetching asset category ${id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/asset-categories/[id] - Update a specific asset category
export async function PUT(request: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // TODO: Add role-based access control if only admins should update categories.
  // if (session.user.role !== 'ADMIN') {
  //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // }

  const { id } = params;

  try {
    const json = await request.json();
    const data = updateAssetCategorySchema.parse(json);

    if (data.parentCategoryId && data.parentCategoryId === id) {
        return NextResponse.json({ error: 'A category cannot be its own parent.' }, { status: 400 });
    }

    // TODO: Advanced: Implement cycle detection if deeper parent changes are allowed via this endpoint.
    // e.g., A -> B -> C. If C tries to become parent of A.

    const updatedAssetCategory = await prisma.assetCategory.update({
      where: { id },
      data: {
        name: data.name,
        type: data.type,
        parentCategoryId: data.parentCategoryId, // Already transformed by Zod to be null or a string
      },
    });

    return NextResponse.json(updatedAssetCategory);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    if (typeof error === 'object' && error !== null && 'code' in error) {
        if (error.code === 'P2002' && typeof error.meta === 'object' && error.meta !== null && 'target' in error.meta && String(error.meta.target).includes('name')) {
            return NextResponse.json({ error: 'An asset category with this name already exists.' }, { status: 409 });
        }
        if (error.code === 'P2003' && typeof error.meta === 'object' && error.meta !== null && 'field_name' in error.meta && String(error.meta.field_name).includes('parentCategoryId')) {
            return NextResponse.json({ error: 'Invalid Parent Category ID provided.' }, { status: 400 });
        }
        if (error.code === 'P2025') {
            return NextResponse.json({ error: 'Asset category not found' }, { status: 404 });
        }
    }
    console.error(`Error updating asset category ${id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/asset-categories/[id] - Delete a specific asset category
export async function DELETE(request: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // TODO: Add role-based access control if only admins should delete categories.

  const { id } = params;

  try {
    const subCategoriesCount = await prisma.assetCategory.count({
        where: { parentCategoryId: id }
    });
    if (subCategoriesCount > 0) {
        return NextResponse.json({ error: 'Cannot delete category: it is a parent to other categories. Please reassign or delete sub-categories first.' }, { status: 400 });
    }

    // Note: Prisma's default referential integrity (RESTRICT) will prevent deletion
    // if this category is actively used by any Account, MutualFund, etc., unless 'onDelete' is set to Cascade or SetNull in schema.
    // The P2003 error code below handles this.

    await prisma.assetCategory.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Asset category deleted successfully' }, { status: 200 });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error) {
        if (error.code === 'P2025') {
            return NextResponse.json({ error: 'Asset category not found' }, { status: 404 });
        }
        if (error.code === 'P2003') { // Foreign key constraint violation
            return NextResponse.json({ error: 'Cannot delete category: it is currently in use by financial records (e.g., accounts, assets).' }, { status: 400 });
        }
    }
    console.error(`Error deleting asset category ${id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
