import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { Prisma } from '@prisma/client';

import { requireAuth } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';

function handleDiaryApiError(scope: string, error: unknown, fallbackMessage: string) {
  console.error(scope, error);

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2021' || error.code === 'P2022')
  ) {
    return NextResponse.json(
      {
        error: 'Diary database schema is not up to date. Run Prisma migration and try again.',
        code: 'DIARY_SCHEMA_OUTDATED',
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}

type Params = { params: Promise<{ journalId: string }> };

async function ensureOwnedJournal(journalId: string, userId: string): Promise<boolean> {
  const journal = await prisma.diaryJournal.findUnique({
    where: { id: journalId },
    select: { id: true, ownerId: true },
  });

  return Boolean(journal && journal.ownerId === userId);
}

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { journalId } = await params;

  try {
    const owned = await ensureOwnedJournal(journalId, auth.userId);
    if (!owned) return NextResponse.json({ error: 'Journal not found' }, { status: 404 });

    const templates = await prisma.diaryTemplate.findMany({
      where: { journalId },
      orderBy: [{ createdAt: 'asc' }],
      select: { id: true, name: true, body: true, createdAt: true, updatedAt: true },
    });

    return NextResponse.json(templates);
  } catch (error) {
    return handleDiaryApiError(
      '[GET /api/diary/journals/[journalId]/templates]',
      error,
      'Failed to load templates',
    );
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  const { journalId } = await params;

  let body: { name?: unknown; body?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const templateBody = typeof body.body === 'string' ? body.body.trim() : '';

  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (!templateBody) {
    return NextResponse.json({ error: 'body is required' }, { status: 400 });
  }
  if (name.length > 80) {
    return NextResponse.json({ error: 'name is too long' }, { status: 400 });
  }
  if (templateBody.length > 20000) {
    return NextResponse.json(
      { error: 'body is too long (max 20 000 characters)' },
      { status: 400 },
    );
  }

  try {
    const owned = await ensureOwnedJournal(journalId, auth.userId);
    if (!owned) return NextResponse.json({ error: 'Journal not found' }, { status: 404 });

    const template = await prisma.diaryTemplate.create({
      data: { journalId, name, body: templateBody },
      select: { id: true, name: true, body: true, createdAt: true, updatedAt: true },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A template with this name already exists', code: 'DUPLICATE_NAME' },
        { status: 409 },
      );
    }

    return handleDiaryApiError(
      '[POST /api/diary/journals/[journalId]/templates]',
      error,
      'Failed to create template',
    );
  }
}
