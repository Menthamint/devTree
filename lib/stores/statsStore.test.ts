/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useStatsStore } from './statsStore';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock navigator.sendBeacon
const mockSendBeacon = vi.fn(() => true);
vi.stubGlobal('navigator', { sendBeacon: mockSendBeacon });

describe('statsStore', () => {
  beforeEach(() => {
    useStatsStore.setState({
      enabled: true,
      trackSessionTime: true,
      trackPageTime: true,
      trackFolderTime: true,
      trackContentEvents: true,
      queue: [],
    });
    vi.clearAllMocks();
  });

  // ── enabled flag ──────────────────────────────────────────────────────────

  it('enqueues events when enabled', () => {
    useStatsStore.getState().enqueue({
      kind: 'SESSION_START',
      timestamp: new Date().toISOString(),
    });

    expect(useStatsStore.getState().queue).toHaveLength(1);
    expect(useStatsStore.getState().queue[0].kind).toBe('SESSION_START');
  });

  it('does not enqueue events when disabled', () => {
    useStatsStore.setState({ enabled: false });

    useStatsStore.getState().enqueue({
      kind: 'SESSION_START',
      timestamp: new Date().toISOString(),
    });

    expect(useStatsStore.getState().queue).toHaveLength(0);
  });

  it('setEnabled updates the tracking flag', () => {
    useStatsStore.getState().setEnabled(false);
    expect(useStatsStore.getState().enabled).toBe(false);

    useStatsStore.getState().setEnabled(true);
    expect(useStatsStore.getState().enabled).toBe(true);
  });

  it('clears queued events when disabling statistics globally', () => {
    useStatsStore.getState().enqueue({
      kind: 'SESSION_START',
      timestamp: new Date().toISOString(),
    });
    expect(useStatsStore.getState().queue).toHaveLength(1);

    useStatsStore.getState().setEnabled(false);
    expect(useStatsStore.getState().queue).toHaveLength(0);
  });

  it('gates session events by trackSessionTime', () => {
    useStatsStore.getState().setTrackSessionTime(false);
    useStatsStore.getState().enqueue({
      kind: 'SESSION_START',
      timestamp: new Date().toISOString(),
    });
    expect(useStatsStore.getState().queue).toHaveLength(0);
  });

  it('gates page and writing events by trackPageTime', () => {
    useStatsStore.getState().setTrackPageTime(false);
    useStatsStore.getState().setTrackFolderTime(false);
    const now = new Date().toISOString();
    useStatsStore.getState().enqueue({ kind: 'PAGE_VISIT_START', pageId: 'p1', timestamp: now });
    useStatsStore.getState().enqueue({
      kind: 'WRITING_SESSION_START',
      pageId: 'p1',
      timestamp: now,
    });
    expect(useStatsStore.getState().queue).toHaveLength(0);
  });

  it('gates content events by trackContentEvents', () => {
    useStatsStore.getState().setTrackContentEvents(false);
    useStatsStore.getState().enqueue({
      kind: 'CONTENT_EVENT',
      type: 'PAGE_VIEWED',
      timestamp: new Date().toISOString(),
    });
    expect(useStatsStore.getState().queue).toHaveLength(0);
  });

  // ── queue management ──────────────────────────────────────────────────────

  it('accumulates multiple events in the queue', () => {
    const now = new Date().toISOString();
    useStatsStore.getState().enqueue({ kind: 'SESSION_START', timestamp: now });
    useStatsStore.getState().enqueue({
      kind: 'PAGE_VISIT_START',
      pageId: 'page-1',
      timestamp: now,
    });
    useStatsStore.getState().enqueue({
      kind: 'CONTENT_EVENT',
      type: 'PAGE_VIEWED',
      pageId: 'page-1',
      timestamp: now,
    });

    expect(useStatsStore.getState().queue).toHaveLength(3);
  });

  // ── flush ─────────────────────────────────────────────────────────────────

  it('flush sends events and clears the queue', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const now = new Date().toISOString();
    useStatsStore.getState().enqueue({ kind: 'SESSION_START', timestamp: now });
    useStatsStore.getState().enqueue({ kind: 'SESSION_END', timestamp: now, durationMs: 1000 });

    await useStatsStore.getState().flush();

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/stats/events');
    expect(opts.method).toBe('POST');

    const body = JSON.parse(opts.body as string) as { events: unknown[] };
    expect(body.events).toHaveLength(2);
    expect(useStatsStore.getState().queue).toHaveLength(0);
  });

  it('flush does nothing when queue is empty', async () => {
    await useStatsStore.getState().flush();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('flush does nothing when disabled', async () => {
    useStatsStore.setState({ enabled: false, queue: [] });

    useStatsStore
      .getState()
      .enqueue({ kind: 'SESSION_START', timestamp: new Date().toISOString() });

    // Queue should be empty because enqueue is a no-op when disabled
    await useStatsStore.getState().flush();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('flush silently ignores network failure (stats loss is acceptable)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const now = new Date().toISOString();
    useStatsStore.getState().enqueue({ kind: 'SESSION_START', timestamp: now });

    // Should not throw even when the fetch fails
    await expect(useStatsStore.getState().flush()).resolves.toBeUndefined();

    // Queue was cleared before the failed request (fire-and-forget semantics)
    expect(useStatsStore.getState().queue).toHaveLength(0);
  });

  it('flush uses sendBeacon when requested', async () => {
    const now = new Date().toISOString();
    useStatsStore.getState().enqueue({ kind: 'SESSION_END', timestamp: now, durationMs: 5000 });

    await useStatsStore.getState().flush({ useSendBeacon: true });

    expect(mockSendBeacon).toHaveBeenCalledOnce();
    const callArgs = mockSendBeacon.mock.calls[0] as unknown as [string, Blob];
    const [url, data] = callArgs;
    expect(url).toBe('/api/stats/events');
    expect(data).toBeInstanceOf(Blob);
    expect(useStatsStore.getState().queue).toHaveLength(0);
  });

  // ── event types ───────────────────────────────────────────────────────────

  it('supports all content event types', () => {
    const contentEventTypes = [
      'PAGE_CREATED',
      'PAGE_DELETED',
      'PAGE_VIEWED',
      'BLOCK_ADDED',
      'BLOCK_EDITED',
      'BLOCK_DELETED',
    ] as const;

    for (const type of contentEventTypes) {
      useStatsStore.getState().enqueue({
        kind: 'CONTENT_EVENT',
        type,
        timestamp: new Date().toISOString(),
      });
    }

    expect(useStatsStore.getState().queue).toHaveLength(contentEventTypes.length);
  });
});
