'use client';

/**
 * BlockWrapper — the outer shell for every content block.
 *
 * Responsibilities:
 *   1. Makes the block sortable via @dnd-kit's useSortable hook.
 *   2. Sets the correct CSS grid column span (half or full width).
 *   3. Renders editing controls that appear on hover (or always on mobile).
 *   4. Positions controls on the correct side (left or right) so they don't
 *      overlap the adjacent block in a two-column layout.
 *   5. Manages the per-block edit/view mode via `isEditing` state.
 *   6. Shows block-level tags at the top of the block.
 *
 * ─── EDIT / VIEW MODE ─────────────────────────────────────────────────────────
 *
 * Blocks start in VIEW mode (read-only). Clicking the pencil icon enters EDIT
 * mode; clicking the check icon (or the pencil again) exits it.
 *
 * WHY per-block rather than page-level edit mode?
 *   Per-block mode lets users read most of the page while editing one section.
 *   Page-level mode would force a full read/write context switch which feels
 *   heavy for note-taking where edits are typically isolated.
 *
 * The `isEditing` flag is passed to block components via a render prop
 * `renderContent(isEditing)` so each block can adapt its own UI without
 * needing a shared global state or context.
 *
 * ─── CONTROLS LAYOUT ──────────────────────────────────────────────────────────
 *
 *   Side controls (drag handle + "add block after" button):
 *     - Desktop: absolutely positioned outside the block in the grid gutter.
 *     - Mobile: hidden — no gutter exists and touch doesn't support hover.
 *
 *   Top-corner controls (edit toggle + width toggle + delete):
 *     - VIEW mode, desktop: opacity-0 by default, fade in on group-hover.
 *     - EDIT mode: always visible so users know which block is being edited.
 *     - Mobile: always visible (opacity-100).
 *
 * WHY CSS opacity transitions over display:none?
 *   Opacity changes are GPU-composited (no layout reflow) and allow smooth
 *   fade animations. Switching display triggers reflow and causes layout shift.
 *
 * ─── BLOCK TAGS (at top) ──────────────────────────────────────────────────────
 *
 * WHY tags at the top rather than the bottom?
 *   Tags are metadata that DESCRIBE the block ("important", "review"). Showing
 *   them before the content follows the "label first" principle — you know what
 *   a block is before you read it, just like a sticky note label.
 *
 *   In view mode: tags are displayed read-only.
 *   In edit mode: tags are editable (add / remove).
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Check, Columns2, GripVertical, Maximize2, Pencil, Plus, Tag, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { formatDateMedium, formatRelativeTime } from '@/lib/dateUtils';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { BlockPicker } from './BlockPicker';
import type { Block, BlockType } from './types';

// ─── Block-level tag colours (deterministic, same palette as page-level) ──────

const BLOCK_TAG_COLOURS = [
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
];

function blockTagColour(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = Math.trunc(hash * 31 + (tag.codePointAt(i) ?? 0));
  return BLOCK_TAG_COLOURS[Math.abs(hash) % BLOCK_TAG_COLOURS.length];
}

const I18N_ADD_TAG = 'block.addTag';

type BlockTagRowProps = Readonly<{
  tags: string[];
  onChange: (tags: string[]) => void;
  /** In view mode tags are display-only; edit controls appear only when editing. */
  isEditing: boolean;
}>;

/**
 * BlockTagRow — tag strip shown at the TOP of every block.
 *
 * View mode:  tags are coloured chips with no interactive controls.
 *             Nothing is rendered if the block has no tags.
 * Edit mode:  tags show a "×" remove button; an "Add tag" input appears.
 *             Rendered even when there are no tags so users can add the first one.
 *
 * WHY separate from page-level TagBar?
 *   Block tags annotate a single block (e.g. "important", "review"); page tags
 *   categorise the whole page. Different sizes and interaction patterns suit
 *   a distinct component better than a one-size-fits-all shared component.
 */
function BlockTagRow({ tags, onChange, isEditing }: BlockTagRowProps) {
  const { t } = useI18n();
  const [isAdding, setIsAdding] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const hasTags = tags.length > 0;

  // In view mode with no tags, render nothing (no empty space above block)
  if (!isEditing && !hasTags) return null;

  const addTag = (raw: string) => {
    const candidates = raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0 && !tags.includes(s));
    if (candidates.length > 0) onChange([...tags, ...candidates]);
    setInputValue('');
    setIsAdding(false);
  };

  const removeTag = (tag: string) => onChange(tags.filter((t) => t !== tag));

  const startAdding = () => {
    setIsAdding(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const cancel = () => { setIsAdding(false); setInputValue(''); };

  return (
    <div className="mb-1.5 flex flex-wrap items-center gap-1.5 px-1">
      <Tag
        size={12}
        className={cn('shrink-0', hasTags ? 'text-muted-foreground/60' : 'text-muted-foreground/30')}
        aria-hidden
      />

      {tags.map((tag) => (
        <span
          key={tag}
          className={cn(
            'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
            blockTagColour(tag),
          )}
        >
          {tag}
          {/* Remove button only in edit mode */}
          {isEditing && (
            <button
              type="button"
              aria-label={`${t('block.removeTag')} ${tag}`}
              className="rounded-full opacity-60 transition-opacity hover:opacity-100"
              onClick={() => removeTag(tag)}
            >
              <X size={10} />
            </button>
          )}
        </span>
      ))}

      {/* Add tag input/button — only in edit mode */}
      {isEditing && (
        isAdding ? (
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            placeholder={t('block.addTagPlaceholder')}
            aria-label={t(I18N_ADD_TAG)}
            className="h-6 w-28 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-ring"
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(inputValue); }
              if (e.key === 'Escape') cancel();
            }}
            onBlur={() => { if (inputValue.trim()) addTag(inputValue); else cancel(); }}
          />
        ) : (
          <button
            type="button"
            aria-label={t(I18N_ADD_TAG)}
            title={t(I18N_ADD_TAG)}
            className="flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/25 px-2 py-0.5 text-xs text-muted-foreground/40 transition-all hover:border-indigo-400 hover:text-indigo-500 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
            onClick={startAdding}
          >
            <Plus size={10} />
            {t(I18N_ADD_TAG)}
          </button>
        )
      )}
    </div>
  );
}

// ─── BlockWrapper ─────────────────────────────────────────────────────────────

type BlockWrapperProps = Readonly<{
  block: Block;
  /**
   * WHY a render prop instead of `children: React.ReactNode`?
   *   `isEditing` lives in BlockWrapper's state. Passing it to the block
   *   content requires either cloneElement (fragile) or a render prop (clean).
   *   `renderContent(isEditing, isDragging, enterEdit, exitEdit)` gives the caller full control.
   *   isDragging is passed so content can unmount heavy editors (e.g. Monaco)
   *   during drag and avoid "domNode" / "InstantiationService disposed" errors.
   */
  renderContent: (isEditing: boolean, isDragging: boolean, enterEdit: () => void, exitEdit: () => void) => React.ReactNode;
  onDelete: () => void;
  onAddAfter: (type: BlockType) => void;
  onToggleColSpan: () => void;
  onTagsChange: (tags: string[]) => void;
  onClearCreatedNowFlag: () => void;
  controlsSide?: 'left' | 'right';
  /** When false, the BlockTagRow is hidden (controlled by global settings). */
  showBlockTags?: boolean;
}>;

export function BlockWrapper({
  block,
  renderContent,
  onDelete,
  onAddAfter,
  onToggleColSpan,
  onTagsChange,
  onClearCreatedNowFlag,
  controlsSide = 'left',
  showBlockTags = true,
}: BlockWrapperProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });

  const style = { transform: CSS.Transform.toString(transform), transition };

  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(block.createdNow ?? false);
  const isHalf = block.colSpan === 1;
  const isRight = controlsSide === 'right';
  // Desktop side placement for the controls badge (avoids nested ternary at call site)
  const sideViewCls = isRight ? 'sm:left-0 sm:-translate-x-1' : 'sm:right-0 sm:translate-x-1';

  // Clear the createdNow flag after the component mounts with edit mode enabled
  useEffect(() => {
    if (block.createdNow) {
      onClearCreatedNowFlag();
    }
  }, [block.createdNow, onClearCreatedNowFlag]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group/block relative',
        isHalf ? 'col-span-full sm:col-span-1' : 'col-span-full sm:col-span-2',
        isDragging && 'z-50 opacity-50',
      )}
    >
      {/* Side controls: drag handle + "add block after" picker */}
      <div
        className={cn(
          'absolute top-0 hidden h-full flex-col items-center gap-1 pt-1 opacity-0 transition-opacity group-hover/block:opacity-100 sm:flex',
          isRight ? '-right-10' : '-left-10',
        )}
      >
        <button
          type="button"
          className="flex h-7 w-7 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground active:cursor-grabbing"
          aria-label={t('block.dragToReorder')}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} />
        </button>
        <BlockPicker onSelect={onAddAfter} compact />
      </div>

      {/**
       * Top-corner controls: edit toggle + width toggle + delete.
       *
       * EDIT MODE: always visible at top-right so users know which block is active.
       * VIEW MODE: hover-only on desktop, always visible on mobile (touch devices).
       *
       * The edit toggle button is styled differently based on mode:
       *   - View mode: subtle outline, pencil icon → click to edit
       *   - Edit mode: indigo filled, check icon → click to confirm/exit
       */}
      <div
        className={cn(
          'absolute z-10 flex items-center gap-1',
          // Mobile: always at top-right inside block
          'top-1 right-1',
          // Edit mode: always visible on desktop too
          isEditing
            ? 'opacity-100'
            : cn(
                'opacity-100',
                'sm:top-0 sm:right-auto sm:-translate-y-1/2',
                'sm:opacity-0 sm:transition-opacity sm:group-hover/block:opacity-100',
                sideViewCls,
              ),
        )}
      >
        {/* Edit / Done toggle */}
        <button
          type="button"
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-md border shadow-sm transition-colors',
            isEditing
              ? 'border-indigo-400 bg-indigo-600 text-white hover:bg-indigo-700 dark:border-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-600'
              : 'border-border bg-card text-muted-foreground hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:border-indigo-700 dark:hover:bg-indigo-900/30',
          )}
          aria-label={isEditing ? t('block.exitEditMode') : t('block.enterEditMode')}
          title={isEditing ? t('block.exitEditMode') : t('block.enterEditMode')}
          onClick={() => setIsEditing((v) => !v)}
        >
          {isEditing ? <Check size={11} /> : <Pencil size={11} />}
        </button>

        {/* Width toggle */}
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-card text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
          aria-label={isHalf ? t('block.expandToFull') : t('block.shrinkToHalf')}
          title={isHalf ? t('block.fullWidth') : t('block.halfWidth')}
          onClick={onToggleColSpan}
        >
          {isHalf ? <Maximize2 size={11} /> : <Columns2 size={11} />}
        </button>

        {/* Delete */}
        <button
          type="button"
          className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-card text-muted-foreground shadow-sm hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-700 dark:hover:bg-red-950 dark:hover:text-red-400"
          aria-label={t('block.deleteBlock')}
          onClick={onDelete}
        >
          <Trash2 size={11} />
        </button>
      </div>

      {/**
       * Block-level tag row — rendered ABOVE the block content.
       *
       * View mode: shows tags as read-only chips; hidden entirely if no tags exist.
       * Edit mode: shows tags with remove buttons + "Add tag" input.
       *
       * WHY tags at the top?
       *   Labels/annotations are most useful BEFORE the content so the reader
       *   knows the block's context before reading it (like a sticky note header).
       */}
      {showBlockTags && (
        <BlockTagRow tags={block.tags ?? []} onChange={onTagsChange} isEditing={isEditing} />
      )}

      {/* Block timestamps — fade in on hover in view mode */}
      {!isEditing && block.updatedAt && (
        <div className={cn(
          'flex items-center gap-1 text-[11px] text-muted-foreground/50 sm:opacity-0 sm:transition-opacity sm:group-hover/block:opacity-100',
          isRight && 'sm:justify-end',
        )}>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-default">
                  {t('block.updatedAt', { date: formatRelativeTime(block.updatedAt) })}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>{formatDateMedium(new Date(block.updatedAt))}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {block.createdAt && block.createdAt !== block.updatedAt && (
            <>
              <span aria-hidden>·</span>
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-default">
                      {t('block.createdAt', { date: formatRelativeTime(block.createdAt) })}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>{formatDateMedium(new Date(block.createdAt))}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
        </div>
      )}

      {/* Block content — rendered via render prop so isEditing/isDragging can be threaded in */}
      {renderContent(isEditing, isDragging, () => setIsEditing(true), () => setIsEditing(false))}
    </div>
  );
}
