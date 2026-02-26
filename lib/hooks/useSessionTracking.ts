/**
 * useSessionTracking — Tracks overall app session time.
 *
 * Mount this hook once at the top of the authenticated app shell
 * (e.g. inside AppShell or a client layout). It:
 *  1. Emits SESSION_START on mount.
 *  2. Pauses / resumes timing on document visibility changes.
 *  3. Emits SESSION_END + flushes via sendBeacon on tab close / navigation away.
 *  4. Periodically flushes any queued events every 60 seconds.
 */

'use client';

import { useEffect, useRef } from 'react';

import { useSession } from 'next-auth/react';

import { useStatsStore } from '@/lib/stores/statsStore';

const FLUSH_INTERVAL_MS = 60_000;

export function useSessionTracking() {
  const { status } = useSession();
  const { enqueue, flush, enabled, trackSessionTime } = useStatsStore();
  // eslint-disable-next-line react-hooks/purity -- Date.now() in useRef initializer is intentional (records mount time)
  const sessionStartRef = useRef<number>(Date.now());
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (status !== 'authenticated' || !enabled || !trackSessionTime) return;

    const startTime = Date.now();
    sessionStartRef.current = startTime;

    enqueue({ kind: 'SESSION_START', timestamp: new Date(startTime).toISOString() });

    // ─── Flush on unload/hide ──────────────────────────────────────────────
    const handleUnload = () => {
      const durationMs = Date.now() - sessionStartRef.current;
      enqueue({
        kind: 'SESSION_END',
        timestamp: new Date().toISOString(),
        durationMs,
      });
      flush({ useSendBeacon: true });
    };

    // ─── Pause/resume on visibility change ────────────────────────────────
    let hiddenAt: number | null = null;
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        handleUnload();
      } else if (document.visibilityState === 'visible') {
        // Resume — reset session start so the hidden gap is excluded
        if (hiddenAt !== null) {
          sessionStartRef.current = Date.now();
          enqueue({ kind: 'SESSION_START', timestamp: new Date().toISOString() });
          hiddenAt = null;
        }
      }
    };

    // ─── Periodic background flush ─────────────────────────────────────────
    flushTimerRef.current = setInterval(() => void flush(), FLUSH_INTERVAL_MS);

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleUnload);
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
    };
  }, [status, enabled, trackSessionTime, enqueue, flush]);
}
