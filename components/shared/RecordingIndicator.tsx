'use client';

/**
 * RecordingIndicator — Global indicator showing when voice dictation is active.
 *
 * This component displays a floating indicator in the top-right corner of the page
 * when any block is recording audio, allowing users to see recording status even
 * when the recording block is scrolled out of view.
 */
import { Mic, X } from 'lucide-react';

import { useRecordingStore } from '@/lib/recordingStore';

export function RecordingIndicator() {
  const isRecording = useRecordingStore((s) => s.isRecording);
  const recordingBlockId = useRecordingStore((s) => s.recordingBlockId);
  const stopRecording = useRecordingStore((s) => s.stopRecording);

  if (!isRecording || !recordingBlockId) {
    return null;
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 flex items-center gap-3 rounded-full bg-red-600 px-3 py-2 text-white shadow-lg">
      <Mic size={16} className="animate-pulse" />
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">Recording</span>
      </div>
      <button
        aria-label="Stop recording"
        onClick={() => stopRecording(recordingBlockId)}
        className="motion-interactive ml-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <X size={12} />
      </button>
    </div>
  );
}
