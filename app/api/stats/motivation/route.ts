import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

/**
 * GET /api/stats/motivation
 *
 * Returns all active motivation messages, ordered by type then by `order`.
 * This endpoint is public (no auth) — the messages contain no user data and
 * are the same for every visitor, making them safe to cache aggressively.
 */
export async function GET() {
  try {
    const messages = await prisma.motivationMessage.findMany({
      where: { active: true },
      orderBy: [{ type: 'asc' }, { order: 'asc' }],
      select: { id: true, type: true, achievementId: true, text: true, emoji: true },
    });
    return NextResponse.json(messages, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=600' },
    });
  } catch (err) {
    console.error('[stats/motivation] Error:', err);
    // Non-fatal — the client falls back to hardcoded messages.
    return NextResponse.json([], { status: 200 });
  }
}
