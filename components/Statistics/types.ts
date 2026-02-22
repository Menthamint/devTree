/** Shared types for the Statistics feature. */

export interface SummaryData {
  totalPages: number;
  totalBlocks: number;
  totalSessionTimeMs: number;
  totalWritingTimeMs: number;
  streakCurrent: number;
  streakLongest: number;
  achievements: string[];
}

export interface ActivityDay {
  date: string; // YYYY-MM-DD
  sessionMs: number;
  pagesVisited: number;
  contentEvents: number;
}

export interface TopicData {
  folderId: string;
  folderName: string;
  timeSpentMs: number;
  pageCount: number;
  eventCount: number;
}

export interface ContentData {
  blockTypeCounts: Record<string, number>;
  eventTypeCounts: Record<string, number>;
  creationTimeline: Array<{ week: string; count: number }>;
}

/** Format milliseconds into a human-readable string (e.g. "2h 15m"). */
export function formatDuration(ms: number): string {
  if (ms < 60_000) return '< 1m';
  const totalMin = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}
