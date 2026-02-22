/**
 * Thin hook to expose settings dialog controls from lib/uiStore.ts.
 * Imported by both ActivityBar (to open) and MainContent (to read state).
 */
export { useUIStore as useSettingsDialog } from '@/lib/uiStore';
