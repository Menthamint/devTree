'use client';
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { Editor } from '@tiptap/core';
import { Smile } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import { ToolbarButton } from './ToolbarButton';

// Lazy-load the heavy Picker component
const EmojiMartPicker = lazy(() =>
  import('@emoji-mart/react').then((mod) => ({ default: mod.default })),
);

type EmojiPickerPopoverProps = {
  editor: Editor;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
};

export function EmojiPickerPopover({
  editor,
  open,
  onOpen,
  onClose,
}: Readonly<EmojiPickerPopoverProps>) {
  const reducedMotion = useReducedMotion();
  const popupDuration = reducedMotion ? 0.01 : 0.16;
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const updatePos = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const PICKER_W = 352;
    const PICKER_H = 435;
    const GAP = 4;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Flip above the button if not enough room below
    const top =
      r.bottom + GAP + PICKER_H > vh && r.top - GAP - PICKER_H >= 0
        ? r.top - PICKER_H - GAP
        : r.bottom + GAP;

    // Clamp so picker doesn't overflow right edge
    const left = Math.min(r.left, vw - PICKER_W - GAP);

    setPos({ top, left });
  }, []);

  // Blur the focused element before the picker opens so emoji-mart can apply
  // aria-hidden to the main app container without the browser blocking it.
  useEffect(() => {
    if (open) (document.activeElement as HTMLElement)?.blur();
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [open, updatePos]);

  const handleSelect = useCallback(
    (emoji: { native: string }) => {
      editor.chain().focus().insertContent(emoji.native).run();
      onClose();
    },
    [editor, onClose],
  );

  const theme =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light';

  return (
    <div className="relative">
      <ToolbarButton ref={btnRef} title="Emoji" active={open} onClick={onOpen}>
        <Smile size={14} />
      </ToolbarButton>

      {createPortal(
        <AnimatePresence>
          {open && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: popupDuration }}
                className="fixed inset-0 z-40"
                aria-hidden
                onClick={onClose}
              />
              {/* Picker */}
              <motion.div
                initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.97 }}
                animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
                transition={{ duration: popupDuration, ease: [0.22, 1, 0.36, 1] }}
                style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 50 }}
              >
                <Suspense fallback={null}>
                  <EmojiMartPicker
                    data={async () => {
                      const data = await import('@emoji-mart/data');
                      return data.default;
                    }}
                    onEmojiSelect={handleSelect}
                    theme={theme}
                  />
                </Suspense>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}
