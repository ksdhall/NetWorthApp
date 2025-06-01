import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient, AssetType } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Zod schema for creating an AssetCategory
const createAssetCategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  type: z.nativeEnum(AssetType), // ASSET or LIABILITY
  // Assuming CUIDs for parentCategoryId, which are strings.
  // Zod's .uuid() is for standard UUID format. For CUIDs, a string check is usually sufficient.
  // If parentCategoryId is an empty string from form, it should be converted to null.
  parentCategoryId: z.string().optional().nullable().transform(val => val === "" ? null : val),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  // For now, allow any authenticated user. Later, this could be restricted to admin roles.
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // TODO: Add role-based access control if only admins should create categories.
  // if (session.user.role !== 'ADMIN') { // Assuming role is part of session user type
  //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  // }

  try {
    const json = await request.json();
    const data = createAssetCategorySchema.parse(json);

    const assetCategory = await prisma.assetCategory.create({
      data: {
        name: data.name,
        type: data.type,
        parentCategoryId: data.parentCategoryId, // Will be null if not provided or empty string
      },
    });

    return NextResponse.json(assetCategory, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    // Handle Prisma specific error codes
    if (typeof error === 'object' && error !== null && 'code' in error) {
        if (error.code === 'P2002' && typeof error.meta === 'object' && error.meta !== null && 'target' in error.meta && String(error.meta.target).includes('name')) {
            return NextResponse.json({ error: 'An asset category with this name already exists.' }, { status: 409 }); // 409 Conflict
        }
        if (error.code === 'P2003' && typeof error.meta === 'object' && error.meta !== null && 'field_name' in error.meta && String(error.meta.field_name).includes('parentCategoryId')) {
            return NextResponse.json({ error: 'Invalid Parent Category ID.' }, { status: 400 });
        }
    }
    console.error("Error creating asset category:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  // Asset categories are likely needed by any authenticated user to categorize their assets.
  // If they were user-specific, the schema would need a userId on AssetCategory.
  // As they are global, authenticating the user seems appropriate for now.
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized to fetch categories' }, { status: 401 });
  }

  try {
    const categories = await prisma.assetCategory.findMany({
      orderBy: [
        { parentCategoryId: 'asc' }, // Group subcategories under parents visually if sorted this way
        { name: 'asc' },
      ],
      include: { // Include parent and subcategories for hierarchical display if needed client-side
        parentCategory: { select: { id: true, name: true } },
        subCategories: { select: { id: true, name: true } },
      }
    });
    return NextResponse.json(categories);
  } catch (error) {
    console.error("Error fetching asset categories:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
