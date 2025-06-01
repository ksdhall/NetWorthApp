import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adjust path as necessary
import { PrismaClient, IdentityDocumentType } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Zod schema for updating an IdentityDocument (all fields optional)
const updateIdentityDocumentSchema = z.object({
  docType: z.nativeEnum(IdentityDocumentType).optional(),
  docNumber: z.string().min(1, "Document number must be at least 1 character").optional(),
  issueDate: z.preprocess((arg) => {
    if (arg === "" || arg === null || arg === undefined) return null; // Allow explicit nullification
    if (typeof arg == "string" || arg instanceof Date) return new Date(arg);
    return undefined; // Let Zod handle if it's not a valid date precursor for optional field
  }, z.date().nullable().optional()),
  expiryDate: z.preprocess((arg) => {
    if (arg === "" || arg === null || arg === undefined) return null;
    if (typeof arg == "string" || arg instanceof Date) return new Date(arg);
    return undefined; // Let Zod handle
  }, z.date().nullable().optional()),
  issuingAuthority: z.string().nullable().optional(),
  isPrimary: z.boolean().optional(),
  scanPath: z.string().nullable().optional(),
});

interface Params {
  id: string;
}

// GET /api/identity-documents/[id] - Get a specific identity document
export async function GET(request: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  try {
    const identityDocument = await prisma.identityDocument.findUnique({
      where: { id },
    });

    if (!identityDocument) {
      return NextResponse.json({ error: 'Identity document not found' }, { status: 404 });
    }

    if (identityDocument.userId !== session.user.id) {
      // Important: Do not reveal if a document ID exists but belongs to another user.
      // Standard practice is to return 404 in this case as well for privacy.
      return NextResponse.json({ error: 'Identity document not found' }, { status: 404 });
    }

    return NextResponse.json(identityDocument);
  } catch (error) {
    console.error(`Error fetching identity document ${id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT /api/identity-documents/[id] - Update a specific identity document
export async function PUT(request: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  try {
    const existingDocument = await prisma.identityDocument.findUnique({
      where: { id },
    });

    if (!existingDocument) {
      return NextResponse.json({ error: 'Identity document not found' }, { status: 404 });
    }

    if (existingDocument.userId !== session.user.id) {
      // As with GET, return 404 to avoid leaking information about resource existence.
      return NextResponse.json({ error: 'Identity document not found' }, { status: 404 });
    }

    const json = await request.json();
    const data = updateIdentityDocumentSchema.parse(json);

    // Prisma handles undefined fields as "no change", which is what we want for a PATCH-like PUT.
    // So, no need to manually remove undefined keys from `data` if Zod produces them for optional fields.

    const updatedIdentityDocument = await prisma.identityDocument.update({
      where: {
        id: id, // Ensure we are updating the document by its ID
        userId: session.user.id, // And that it belongs to the current user (double check)
      },
      data: data, // Pass validated data directly
    });

    return NextResponse.json(updatedIdentityDocument);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    // Handle potential Prisma errors, e.g., if update fails due to record not found by combined where for id+userId
    // This can happen if the initial check passes but something changes, though unlikely here.
    // Or if the unique constraint on [userId, docType, docNumber] is violated by the update.
    if (error.code === 'P2025') { // Prisma error code for "Record to update not found."
        return NextResponse.json({ error: 'Identity document not found or access denied' }, { status: 404 });
    }
    if (error.code === 'P2002') { // Prisma error code for unique constraint violation
        return NextResponse.json({ error: 'Update violates unique constraint (e.g. docType + docNumber already exists for this user)' }, { status: 409 });
    }
    console.error(`Error updating identity document ${id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/identity-documents/[id] - Delete a specific identity document
export async function DELETE(request: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  try {
    // It's better to use a delete operation that inherently checks ownership
    // by including userId in the where clause. This prevents a separate select query.
    const deleteResult = await prisma.identityDocument.deleteMany({
      where: {
        id: id,
        userId: session.user.id, // Ensures only the owner can delete
      },
    });

    if (deleteResult.count === 0) {
      // This means either the document didn't exist or it didn't belong to the user.
      return NextResponse.json({ error: 'Identity document not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Identity document deleted successfully' }, { status: 200 });
  } catch (error) {
    console.error(`Error deleting identity document ${id}:`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
