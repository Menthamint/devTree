import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import type { ContentEventType as PrismaContentEventType } from '@prisma/client';

const MAX_EVENTS_PER_REQUEST = 100;

type StatEvent = {
  kind: string;
  timestamp?: string;
  durationMs?: number;
  pageId?: string;
  folderId?: string;
  blockId?: string;
  type?: string; // for CONTENT_EVENT
};

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ('error' in auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { userId } = auth;

  let body: { events: StatEvent[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!Array.isArray(body.events) || body.events.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const events = body.events.slice(0, MAX_EVENTS_PER_REQUEST);

  // Process events in a single transaction
  try {
    await prisma.$transaction(async (tx) => {
    for (const ev of events) {
      const ts = ev.timestamp ? new Date(ev.timestamp) : new Date();

      switch (ev.kind) {
        case 'SESSION_START':
          await tx.userSession.create({
            data: { userId, startedAt: ts },
          });
          break;

        case 'SESSION_END': {
          // Find the most recent open session and close it
          const openSession = await tx.userSession.findFirst({
            where: { userId, endedAt: null },
            orderBy: { startedAt: 'desc' },
          });
          if (openSession) {
            await tx.userSession.update({
              where: { id: openSession.id },
              data: { endedAt: ts, durationMs: ev.durationMs ?? null },
            });
          }
          break;
        }

        case 'PAGE_VISIT_START':
          if (ev.pageId) {
            await tx.pageVisit.create({
              data: { userId, pageId: ev.pageId, folderId: ev.folderId ?? null, startedAt: ts },
            });
          }
          break;

        case 'PAGE_VISIT_END': {
          if (ev.pageId) {
            const openVisit = await tx.pageVisit.findFirst({
              where: { userId, pageId: ev.pageId, endedAt: null },
              orderBy: { startedAt: 'desc' },
            });
            if (openVisit) {
              await tx.pageVisit.update({
                where: { id: openVisit.id },
                data: { endedAt: ts, durationMs: ev.durationMs ?? null },
              });
            }
          }
          break;
        }

        case 'CONTENT_EVENT':
          if (ev.type) {
            await tx.contentEvent.create({
              data: {
                userId,
                type: ev.type as PrismaContentEventType,
                pageId: ev.pageId ?? null,
                folderId: ev.folderId ?? null,
                blockId: ev.blockId ?? null,
                timestamp: ts,
              },
            });
          }
          break;

        default:
          break;
      }
    }

    // Update streak
    await upsertStreak(tx, userId);
  });
  } catch (err) {
    console.error('[stats/events] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/** Upsert the user's streak based on today's activity. */
async function upsertStreak(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  userId: string,
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  const streak = await tx.userStreak.findUnique({ where: { userId } });

  if (!streak) {
    await tx.userStreak.create({
      data: { userId, currentStreak: 1, longestStreak: 1, lastActiveDate: today },
    });
    return;
  }

  const last = streak.lastActiveDate;
  if (!last) {
    await tx.userStreak.update({
      where: { userId },
      data: { currentStreak: 1, longestStreak: Math.max(1, streak.longestStreak), lastActiveDate: today },
    });
    return;
  }

  const lastStr = last.toISOString().split('T')[0];
  if (lastStr === todayStr) return; // already updated today

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const newCurrent = lastStr === yesterdayStr ? streak.currentStreak + 1 : 1;
  const newLongest = Math.max(newCurrent, streak.longestStreak);

  await tx.userStreak.update({
    where: { userId },
    data: { currentStreak: newCurrent, longestStreak: newLongest, lastActiveDate: today },
  });
}
