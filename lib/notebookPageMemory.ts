const LAST_NOTEBOOK_PAGE_ID_KEY = 'devtree:lastNotebookPageId';

function canUseStorage(): boolean {
  return globalThis.localStorage !== undefined;
}

export function getLastNotebookPageId(): string | null {
  if (!canUseStorage()) return null;
  try {
    return globalThis.localStorage.getItem(LAST_NOTEBOOK_PAGE_ID_KEY);
  } catch {
    return null;
  }
}

export function setLastNotebookPageId(pageId: string): void {
  if (!canUseStorage()) return;
  try {
    globalThis.localStorage.setItem(LAST_NOTEBOOK_PAGE_ID_KEY, pageId);
  } catch {
    // Ignore storage failures (private mode, quota, etc.)
  }
}

export function clearLastNotebookPageId(): void {
  if (!canUseStorage()) return;
  try {
    globalThis.localStorage.removeItem(LAST_NOTEBOOK_PAGE_ID_KEY);
  } catch {
    // Ignore storage failures.
  }
}
