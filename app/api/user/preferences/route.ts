import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { prisma } from '@/lib/prisma';

/** Shape of user preferences stored in DB (JSON). */
export type UserPreferences = {
  theme?: 'light' | 'dark' | 'system';
  locale?: 'en' | 'uk';
  tagsPerPageEnabled?: boolean;
  tagsPerBlockEnabled?: boolean;
  recordingStartSoundEnabled?: boolean;
  // Statistics tracking preferences (all default to true when absent)
  statisticsEnabled?: boolean;
  trackSessionTime?: boolean;
  trackPageTime?: boolean;
  trackFolderTime?: boolean;
  trackContentEvents?: boolean;
};

function isPreferencesBody(body: unknown): body is Partial<Record<keyof UserPreferences, unknown>> {
  return typeof body === 'object' && body !== null;
}

function getUpdates(body: Partial<Record<keyof UserPreferences, unknown>>): UserPreferences {
  const updates: UserPreferences = {};

  if (body.theme === 'light' || body.theme === 'dark' || body.theme === 'system') {
    updates.theme = body.theme;
  }
  if (body.locale === 'en' || body.locale === 'uk') {
    updates.locale = body.locale;
  }

  const booleanKeys = [
    'tagsPerPageEnabled',
    'tagsPerBlockEnabled',
    'recordingStartSoundEnabled',
    'statisticsEnabled',
    'trackSessionTime',
    'trackPageTime',
    'trackFolderTime',
    'trackContentEvents',
  ] as const;

  for (const key of booleanKeys) {
    const value = body[key];
    if (typeof value === 'boolean') {
      updates[key] = value;
    }
  }

  return updates;
}

/**
 * GET /api/user/preferences — return the current user's saved preferences.
 * Returns an empty object if none are set.
 */
export async function GET(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  });
  if (!token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: token.sub },
    select: { preferences: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const prefs = (user.preferences as UserPreferences | null) ?? {};
  return NextResponse.json(prefs);
}

/**
 * PATCH /api/user/preferences — merge provided preferences into the user's stored preferences.
 * Only top-level keys present in the body are updated; others are left unchanged.
 */
export async function PATCH(req: NextRequest) {
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  });
  if (!token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!isPreferencesBody(body)) {
    return NextResponse.json({ error: 'Body must be an object' }, { status: 400 });
  }

  const updates = getUpdates(body);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid preference fields' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: token.sub },
    select: { preferences: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const current = (user.preferences as UserPreferences | null) ?? {};
  const merged: UserPreferences = { ...current, ...updates };

  const purgeDisabledStats = req.nextUrl.searchParams.get('purgeDisabledStats') === '1';

  const shouldPurgeAllStats = purgeDisabledStats && updates.statisticsEnabled === false;
  const shouldPurgeSession = purgeDisabledStats && updates.trackSessionTime === false;
  const shouldPurgePage =
    purgeDisabledStats && (updates.trackPageTime === false || updates.trackFolderTime === false);
  const shouldPurgeContent = purgeDisabledStats && updates.trackContentEvents === false;

  const tx = [
    prisma.user.update({
      where: { id: token.sub },
      data: { preferences: merged },
    }),
    ...(shouldPurgeAllStats || shouldPurgeSession
      ? [prisma.userSession.deleteMany({ where: { userId: token.sub } })]
      : []),
    ...(shouldPurgeAllStats || shouldPurgePage
      ? [
          prisma.pageVisit.deleteMany({ where: { userId: token.sub } }),
          prisma.writingSession.deleteMany({ where: { userId: token.sub } }),
        ]
      : []),
    ...(shouldPurgeAllStats || shouldPurgeContent
      ? [prisma.contentEvent.deleteMany({ where: { userId: token.sub } })]
      : []),
    ...(shouldPurgeAllStats
      ? [prisma.userStreak.deleteMany({ where: { userId: token.sub } })]
      : []),
  ];

  await prisma.$transaction(tx);

  return NextResponse.json(merged);
}
