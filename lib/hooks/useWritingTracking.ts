/**
 * useWritingTracking — Tracks time the user spends actively in edit mode.
 *
 * Unlike page-visit tracking (which records total time on a page), this hook
 * only measures time when the editor is open and the user can type.
 * The resulting WritingSession rows power the "Writing Time" stat card.
 *
 * Mount this next to usePageTracking in Workspace.tsx, passing `isEditMode`
 * from useSaveLogic and the current page / folder ids.
 */

'use client';

import { useEffect, useRef } from 'react';

import { useSession } from 'next-auth/react';

import { useStatsStore } from '@/lib/stores/statsStore';

interface WritingTrackingOptions {
  isEditMode: boolean;
  pageId: string | undefined;
  folderId?: string | undefined;
}

export function useWritingTracking({ isEditMode, pageId, folderId }: WritingTrackingOptions) {
  const { status } = useSession();
  const { enqueue, flush, enabled } = useStatsStore();
  const sessionRef = useRef<{ startMs: number; pageId: string } | null>(null);

  // Helper — close the current writing session and flush.
  const closeSession = (pg: string, startMs: number) => {
    const durationMs = Date.now() - startMs;
    enqueue({
      kind: 'WRITING_SESSION_END',
      pageId: pg,
      folderId,
      timestamp: new Date().toISOString(),
      durationMs,
    });
    void flush();
  };

  // React to isEditMode / pageId changes.
  useEffect(() => {
    if (status !== 'authenticated' || !enabled) return;

    if (isEditMode && pageId) {
      // Close any lingering session for a different page before starting a new one.
      if (sessionRef.current && sessionRef.current.pageId !== pageId) {
        closeSession(sessionRef.current.pageId, sessionRef.current.startMs);
        sessionRef.current = null;
      }

      if (!sessionRef.current) {
        const startMs = Date.now();
        sessionRef.current = { startMs, pageId };
        enqueue({
          kind: 'WRITING_SESSION_START',
          pageId,
          folderId,
          timestamp: new Date(startMs).toISOString(),
        });
      }
    } else {
      // Edit mode turned off or page cleared — close any open session.
      if (sessionRef.current) {
        closeSession(sessionRef.current.pageId, sessionRef.current.startMs);
        sessionRef.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, pageId, status, enabled]);

  // Flush on tab close / navigation away.
  useEffect(() => {
    const handleUnload = () => {
      if (sessionRef.current) {
        closeSession(sessionRef.current.pageId, sessionRef.current.startMs);
        flush({ useSendBeacon: true });
        sessionRef.current = null;
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folderId]);
}
