/**
 * usePageTracking — Tracks time spent on individual pages.
 *
 * Call this inside Workspace.tsx, passing the currently active page ID
 * and the page's parent folder ID. It emits PAGE_VISIT_START when a page
 * becomes active and PAGE_VISIT_END when navigating away.
 */

'use client';

import { useEffect, useRef } from 'react';

import { useSession } from 'next-auth/react';

import { useStatsStore } from '@/lib/stores/statsStore';

interface PageTrackingOptions {
  pageId: string | undefined;
  folderId?: string;
}

export function usePageTracking({ pageId, folderId }: PageTrackingOptions) {
  const { status } = useSession();
  const { enqueue, flush, enabled, trackPageTime, trackFolderTime } = useStatsStore();
  const visitStartRef = useRef<{ pageId: string; startMs: number } | null>(null);

  const closeVisit = (currentPageId: string, startMs: number) => {
    const durationMs = Date.now() - startMs;
    enqueue({
      kind: 'PAGE_VISIT_END',
      pageId: currentPageId,
      folderId,
      timestamp: new Date().toISOString(),
      durationMs,
    });
    void flush();
  };

  useEffect(() => {
    if (status !== 'authenticated' || !enabled || !(trackPageTime || trackFolderTime)) return;
    if (!pageId) return;

    // Close previous visit if switching pages
    if (visitStartRef.current && visitStartRef.current.pageId !== pageId) {
      closeVisit(visitStartRef.current.pageId, visitStartRef.current.startMs);
    }

    const startMs = Date.now();
    visitStartRef.current = { pageId, startMs };

    enqueue({
      kind: 'PAGE_VISIT_START',
      pageId,
      folderId,
      timestamp: new Date(startMs).toISOString(),
    });

    // PAGE_VIEWED content event
    enqueue({
      kind: 'CONTENT_EVENT',
      type: 'PAGE_VIEWED',
      pageId,
      folderId,
      timestamp: new Date().toISOString(),
    });

    const handleUnload = () => {
      if (visitStartRef.current) {
        closeVisit(visitStartRef.current.pageId, visitStartRef.current.startMs);
        visitStartRef.current = null;
      }
    };

    window.addEventListener('beforeunload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      // Close visit on pageId change (handled above on next run) or unmount
      if (visitStartRef.current?.pageId === pageId) {
        closeVisit(pageId, visitStartRef.current.startMs);
        visitStartRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId, status, enabled, trackPageTime, trackFolderTime]);
}
