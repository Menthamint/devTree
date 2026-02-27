/**
 * recordingStore.ts — Global state for voice dictation recording.
 *
 * Manages the recording state across all text blocks and the application,
 * allowing a global indicator to show when any block is currently recording.
 */
import { create } from 'zustand';

import { playRecordingStartSound } from '@/lib/stores/recordingSound';
import { useSettingsStore } from '@/lib/stores/settingsStore';

type RecordingState = {
  /** Whether any block is currently recording */
  isRecording: boolean;

  /** ID of the block that's currently recording (if any) */
  recordingBlockId: string | null;

  // ─── Actions ──────────────────────────────────────────────────────────

  /** Start recording for a specific block */
  startRecording: (blockId: string, cancelCallback: () => void) => void;

  /** Stop recording for a specific block */
  stopRecording: (blockId: string) => void;

  /** Callback to cancel recording, set by the block that started recording */
  cancelRecordingCallback: () => void;
};

export const useRecordingStore = create<RecordingState>((set) => ({
  isRecording: false,
  recordingBlockId: null,
  cancelRecordingCallback: () => {},

  startRecording: (blockId: string, cancelCallback: () => void) => {
    if (useSettingsStore.getState().recordingStartSoundEnabled) {
      playRecordingStartSound();
    }
    set({ isRecording: true, recordingBlockId: blockId, cancelRecordingCallback: cancelCallback });
  },

  stopRecording: (blockId: string) => {
    const state = useRecordingStore.getState();
    if (state.recordingBlockId !== blockId) {
      return;
    }

    const cancelCallback = state.cancelRecordingCallback;
    set({
      isRecording: false,
      recordingBlockId: null,
      cancelRecordingCallback: () => {},
    });

    cancelCallback?.();
  },
}));
