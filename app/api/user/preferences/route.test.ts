/** @vitest-environment node */
import { NextRequest } from 'next/server';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PATCH } from './route';

const mockGetToken = vi.hoisted(() => vi.fn());
vi.mock('next-auth/jwt', () => ({ getToken: mockGetToken }));

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  userSession: {
    deleteMany: vi.fn(),
  },
  pageVisit: {
    deleteMany: vi.fn(),
  },
  writingSession: {
    deleteMany: vi.fn(),
  },
  contentEvent: {
    deleteMany: vi.fn(),
  },
  userStreak: {
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
}));
vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));

function makePatchRequest(body: unknown, query = '') {
  return new NextRequest(`http://localhost/api/user/preferences${query}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('PATCH /api/user/preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue({ preferences: {} });
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.userSession.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.pageVisit.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.writingSession.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.contentEvent.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.userStreak.deleteMany.mockResolvedValue({ count: 0 });
    mockGetToken.mockResolvedValue({ sub: 'user-1' });
  });

  it('returns 401 when user is unauthenticated', async () => {
    mockGetToken.mockResolvedValue(null);

    const res = await PATCH(makePatchRequest({ trackContentEvents: false }));

    expect(res.status).toBe(401);
  });

  it('purges content events when trackContentEvents is disabled with purge flag', async () => {
    const res = await PATCH(
      makePatchRequest({ trackContentEvents: false }, '?purgeDisabledStats=1'),
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.contentEvent.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(mockPrisma.user.update).toHaveBeenCalled();
  });

  it('purges all statistics tables when statisticsEnabled is disabled with purge flag', async () => {
    const res = await PATCH(
      makePatchRequest({ statisticsEnabled: false }, '?purgeDisabledStats=1'),
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.userSession.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(mockPrisma.pageVisit.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(mockPrisma.writingSession.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(mockPrisma.contentEvent.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(mockPrisma.userStreak.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
  });
});
