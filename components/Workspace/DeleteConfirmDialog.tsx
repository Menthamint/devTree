'use client';

/**
 * DeleteConfirmDialog — a reusable confirmation dialog for destructive actions.
 *
 * ─── WHY A SEPARATE COMPONENT? ────────────────────────────────────────────────
 *
 * The delete confirmation pattern (title + description + Cancel/Confirm) is used
 * whenever the user tries to remove a page or folder. Extracting it into a
 * standalone component:
 *   - Keeps Workspace.tsx focused on state management, not modal UI.
 *   - Makes the confirmation dialog reusable for future destructive actions.
 *   - Centralises the "Cancel"/"Delete" labels in one place (via i18n).
 *
 * ─── RADIX UI ALERT DIALOG ────────────────────────────────────────────────────
 *
 * We use Radix UI's `AlertDialog` rather than a regular `Dialog` because the
 * semantic difference matters for accessibility:
 *   - `Dialog` is for supplementary information or non-destructive forms.
 *   - `AlertDialog` signals an important, potentially irreversible action.
 *     Screen readers announce it with higher urgency (role="alertdialog").
 *
 * The dialog is "controlled" — `open` and `onOpenChange` are passed from the
 * parent. This gives Workspace full control over when the dialog appears and
 * disappears, including closing it programmatically after confirmation.
 *
 * ─── IMPROVEMENT IDEAS ────────────────────────────────────────────────────────
 *   - Add a loading spinner on the Delete button while a server delete request
 *     is in flight (when persistence is added).
 *   - Add keyboard shortcut: Enter confirms, Escape cancels (Radix handles
 *     Escape by default via the dialog's onOpenChange).
 */

import React from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useI18n } from '@/lib/i18n';

type DeleteConfirmDialogProps = Readonly<{
  open: boolean;
  /** Called by Radix when the dialog should close (Escape key, backdrop click, Cancel). */
  onOpenChange: (open: boolean) => void;
  /** Dialog heading — e.g. "Delete page?" or "Delete folder?" */
  title: string;
  /** Detailed explanation of what will be removed. */
  description: string;
  /** Called when the user clicks the destructive "Delete" action button. */
  onConfirm: () => void;
}>;

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
}: DeleteConfirmDialogProps) {
  const { t } = useI18n();

  /**
   * Run the deletion AND close the dialog in a single handler.
   *
   * WHY not call onConfirm and rely on the parent to close?
   *   The parent could close the dialog from inside onConfirm's logic, but that
   *   would couple the deletion logic to UI lifecycle concerns. Closing here is
   *   the dialog's own responsibility — separation of concerns.
   */
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {/* Cancel — safe action, dismisses without side effects */}
          <AlertDialogCancel data-testid="confirm-delete-cancel">{t('delete.cancel')}</AlertDialogCancel>
          {/* Confirm — destructive action, styled red by AlertDialogAction variant */}
          <AlertDialogAction data-testid="confirm-delete-confirm" onClick={handleConfirm}>
            {t('delete.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
