import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Adjust path as necessary
import { PrismaClient, IdentityDocumentType } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Zod schema for creating an IdentityDocument
const createIdentityDocumentSchema = z.object({
  docType: z.nativeEnum(IdentityDocumentType),
  docNumber: z.string().min(1, "Document number is required"),
  issueDate: z.preprocess((arg) => {
    if (typeof arg == "string" || arg instanceof Date) return new Date(arg);
    return null; // Ensure null if not a valid date string or undefined
  }, z.date().optional().nullable()),
  expiryDate: z.preprocess((arg) => {
    if (typeof arg == "string" || arg instanceof Date) return new Date(arg);
    return null; // Ensure null if not a valid date string or undefined
  }, z.date().optional().nullable()),
  issuingAuthority: z.string().optional().nullable(),
  isPrimary: z.boolean().optional().default(false),
  scanPath: z.string().optional().nullable(), // Placeholder for now
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const json = await request.json();
    const data = createIdentityDocumentSchema.parse(json);

    const identityDocument = await prisma.identityDocument.create({
      data: {
        userId: session.user.id,
        docType: data.docType,
        docNumber: data.docNumber,
        issueDate: data.issueDate,
        expiryDate: data.expiryDate,
        issuingAuthority: data.issuingAuthority,
        isPrimary: data.isPrimary,
        scanPath: data.scanPath, // Store placeholder or filename
      },
    });

    return NextResponse.json(identityDocument, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Error creating identity document:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const identityDocuments = await prisma.identityDocument.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: 'desc', // Or by docType, etc.
      },
    });
    return NextResponse.json(identityDocuments);
  } catch (error) {
    console.error("Error fetching identity documents:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
