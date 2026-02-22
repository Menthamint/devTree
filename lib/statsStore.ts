/**
 * statsStore.ts — Client-side statistics event queue managed with Zustand.
 *
 * Events are queued here and periodically flushed to /api/stats/events.
 * The flush uses `navigator.sendBeacon` when possible (e.g. on page unload)
 * so events are not lost when the user closes the tab.
 *
 * All enqueue operations are no-ops when statistics tracking is disabled
 * in the user's settings (statisticsEnabled = false in preferences).
 */

import { create } from 'zustand';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContentEventType =
  | 'PAGE_CREATED'
  | 'PAGE_DELETED'
  | 'PAGE_VIEWED'
  | 'BLOCK_ADDED'
  | 'BLOCK_EDITED'
  | 'BLOCK_DELETED';

export interface SessionStartEvent {
  kind: 'SESSION_START';
  timestamp: string; // ISO
}

export interface SessionEndEvent {
  kind: 'SESSION_END';
  timestamp: string;
  durationMs: number;
}

export interface PageVisitStartEvent {
  kind: 'PAGE_VISIT_START';
  pageId: string;
  folderId?: string;
  timestamp: string;
}

export interface PageVisitEndEvent {
  kind: 'PAGE_VISIT_END';
  pageId: string;
  folderId?: string;
  timestamp: string;
  durationMs: number;
}

export interface ContentEventPayload {
  kind: 'CONTENT_EVENT';
  type: ContentEventType;
  pageId?: string;
  folderId?: string;
  blockId?: string;
  timestamp: string;
}

export type StatEvent =
  | SessionStartEvent
  | SessionEndEvent
  | PageVisitStartEvent
  | PageVisitEndEvent
  | ContentEventPayload;

// ─── Store ────────────────────────────────────────────────────────────────────

type StatsState = {
  /** Whether statistics tracking is enabled (mirrors user preference). */
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;

  /** Pending events not yet flushed to the server. */
  queue: StatEvent[];

  enqueue: (event: StatEvent) => void;

  /**
   * Flush all queued events to the API.
   * Uses sendBeacon when `useSendBeacon` is true (for unload scenarios).
   */
  flush: (opts?: { useSendBeacon?: boolean }) => Promise<void>;
};

export const useStatsStore = create<StatsState>()((set, get) => ({
  enabled: true,
  setEnabled: (enabled) => set({ enabled }),
  queue: [],

  enqueue: (event) => {
    if (!get().enabled) return;
    set((s) => ({ queue: [...s.queue, event] }));
  },

  flush: async ({ useSendBeacon = false } = {}) => {
    const { queue, enabled } = get();
    if (!enabled || queue.length === 0) return;

    const payload = JSON.stringify({ events: queue });
    set({ queue: [] });

    if (useSendBeacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/stats/events', new Blob([payload], { type: 'application/json' }));
      return;
    }

    try {
      await fetch('/api/stats/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      });
    } catch {
      // Silently ignore — stats loss on network failure is acceptable.
    }
  },
}));
