'use client';

/**
 * confirmationContext.tsx — Global confirmation dialog state management.
 *
 * Provides a promise-based API for showing confirmation dialogs throughout the app.
 * Uses React Context and Zustand-inspired patterns for state management.
 */
import React, { useCallback, useMemo, useState } from 'react';

export type ConfirmationConfig = Readonly<{
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  /**
   * Variant controls layout style. 'default' is the existing centered modal.
   * Other values allow non-blocking toast or inline banners.
   */
  variant?: 'default' | 'destructive' | 'toast' | 'inline';
  /**
   * Tone influences color treatment; keeps compatibility with 'destructive'.
   */
  tone?: 'default' | 'destructive' | 'warning' | 'info';
}>;

type ConfirmationContextValue = {
  confirm: (config: ConfirmationConfig) => Promise<boolean>;
};

const ConfirmationContext = React.createContext<ConfirmationContextValue | null>(null);

type PendingConfirmation = ConfirmationConfig & {
  id: string;
  resolve: (value: boolean) => void;
};

let confirmationCounter = 0;

const CONFIRM_PRIMARY_BTN = 'bg-primary hover:opacity-90';
const CONFIRM_CANCEL_BTN =
  'rounded border border-border px-3 py-1 text-sm font-medium hover:bg-accent';
const CONFIRM_DESTRUCTIVE_BTN = 'bg-red-600 hover:bg-red-700';

export function ConfirmationProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [activeConfirmation, setActiveConfirmation] = useState<PendingConfirmation | null>(null);

  const confirm = useCallback((config: ConfirmationConfig): Promise<boolean> => {
    return new Promise((resolve) => {
      confirmationCounter += 1;
      const id = `confirmation-${Date.now()}-${confirmationCounter}`;
      setActiveConfirmation({ ...config, id, resolve });
    });
  }, []);

  const handleConfirm = useCallback(
    (value: boolean) => {
      if (activeConfirmation) {
        activeConfirmation.resolve(value);
        setActiveConfirmation(null);
      }
    },
    [activeConfirmation],
  );

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmationContext.Provider value={value}>
      {children}
      {activeConfirmation && (
        <ConfirmationDialog
          config={activeConfirmation}
          onConfirm={() => handleConfirm(true)}
          onCancel={() => handleConfirm(false)}
        />
      )}
    </ConfirmationContext.Provider>
  );
}

/**
 * useConfirmation — Get access to the confirmation dialog.
 *
 * Usage:
 *   const { confirm } = useConfirmation();
 *   const result = await confirm({
 *     title: 'Delete item?',
 *     description: 'This cannot be undone.',
 *     confirmText: 'Delete',
 *     cancelText: 'Cancel',
 *     variant: 'destructive'
 *   });
 *   if (result) console.log('Confirmed!');
 */
export function useConfirmation(): ConfirmationContextValue {
  const ctx = React.useContext(ConfirmationContext);
  if (!ctx) {
    throw new Error('useConfirmation must be used within ConfirmationProvider');
  }
  return ctx;
}

const MAX_WIDTH_CLASS = 'max-w-3xl';

function ConfirmationDialog({
  config,
  onConfirm,
  onCancel,
}: Readonly<{
  config: ConfirmationConfig;
  onConfirm: () => void;
  onCancel: () => void;
}>) {
  const {
    title,
    description,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'default',
    tone = 'default',
  } = config;

  const isDestructive = variant === 'destructive' || tone === 'destructive';

  // Render different layouts based on variant
  if (variant === 'toast') {
    return (
      <div className="bg-card fixed right-6 bottom-6 z-50 w-full max-w-xs rounded-lg p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="text-foreground text-sm font-semibold">{title}</div>
            {description && <div className="text-muted-foreground mt-1 text-xs">{description}</div>}
            <div className="mt-3 flex gap-2">
              <button
                onClick={onConfirm}
                className={`rounded px-3 py-1 text-sm font-medium text-white ${
                  isDestructive ? CONFIRM_DESTRUCTIVE_BTN : CONFIRM_PRIMARY_BTN
                }`}
              >
                {confirmText}
              </button>
              <button onClick={onCancel} className={CONFIRM_CANCEL_BTN}>
                {cancelText}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div
        className={`fixed top-4 left-1/2 z-50 w-full ${MAX_WIDTH_CLASS} -translate-x-1/2 rounded-md bg-yellow-50 p-4 shadow-sm`}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-foreground text-sm font-medium">{title}</div>
            {description && <div className="text-muted-foreground mt-1 text-sm">{description}</div>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onCancel} className={CONFIRM_CANCEL_BTN}>
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`rounded px-3 py-1 text-sm font-medium text-white ${
                isDestructive ? CONFIRM_DESTRUCTIVE_BTN : CONFIRM_PRIMARY_BTN
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default modal dialog (centered)
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onCancel} aria-hidden="true" />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="border-border bg-card w-full max-w-sm rounded-lg border p-6 shadow-lg"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirmation-title"
          aria-describedby="confirmation-description"
        >
          {/* Title */}
          <h2 id="confirmation-title" className="text-foreground text-lg font-semibold">
            {title}
          </h2>

          {/* Description */}
          {description && (
            <p id="confirmation-description" className="text-muted-foreground mt-2 text-sm">
              {description}
            </p>
          )}

          {/* Buttons */}
          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="border-border hover:bg-accent flex-1 rounded border px-4 py-2 text-sm font-medium transition-colors"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`flex-1 rounded px-4 py-2 text-sm font-medium text-white transition-colors ${
                isDestructive ? 'bg-red-600 hover:bg-red-700' : 'bg-primary hover:opacity-90'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
