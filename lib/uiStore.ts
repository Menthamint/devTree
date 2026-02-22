/**
 * uiStore.ts — Global UI state managed with Zustand.
 *
 * Stores transient UI state (dialog open/close, etc.) that needs to be shared
 * across components not in a direct parent-child relationship.
 * E.g., the ActivityBar (outside Workspace) opening the SettingsDialog (inside MainContent).
 */

import { create } from 'zustand';

type UIState = {
  /** Whether the SettingsDialog is open. */
  settingsDialogOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
};

export const useUIStore = create<UIState>()((set) => ({
  settingsDialogOpen: false,
  openSettings: () => set({ settingsDialogOpen: true }),
  closeSettings: () => set({ settingsDialogOpen: false }),
}));
