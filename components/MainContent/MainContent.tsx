'use client';

/**
 * MainContent — the right-hand panel of the workspace.
 *
 * Responsibilities:
 *   1. Renders the top header bar with page breadcrumb, save button, export
 *      button, and user avatar menu.
 *   2. Renders the scrollable page area containing PageTitle + TagBar +
 *      BlockEditor.
 *   3. Shows an empty-state illustration when no page is selected.
 *   4. Displays real-time page statistics (word count, reading time, block
 *      count) in a footer below the editor.
 *
 * KEYBOARD SHORTCUTS
 *   Cmd/Ctrl+S → save the current page.
 *
 * IMPROVEMENT IDEAS:
 *   - Add a breadcrumb path (e.g. "Folder / Sub-folder / Page title").
 *   - Add an undo/redo toolbar for block operations.
 *   - Animate the stats footer appearance with a CSS transition.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Download, Filter, Menu, Save, Tag, X } from 'lucide-react';

import { useI18n } from '@/lib/i18n';
import { computePageStats, downloadMarkdown } from '@/lib/pageUtils';
import { useSettingsStore } from '@/lib/settingsStore';
import { cn } from '@/lib/utils';

import { BlockEditor } from './BlockEditor';
import { PageMeta } from './PageMeta';
import { PageTitle } from './PageTitle';
import type { Block, Page } from './types';

const I18N_EXPORT_MARKDOWN = 'main.exportMarkdown';

type MainContentProps = Readonly<{
  page: Page | null;
  breadcrumbs?: Array<{ id: string; label: string; isCurrent: boolean }>;
  onBreadcrumbClick?: (id: string) => void;
  onSave?: () => void;
  saved?: boolean;
  /**
   * True when there are local edits not yet persisted to the server.
   * When false the Save button is disabled to avoid redundant API calls.
   */
  isDirty?: boolean;
  onTitleChange?: (title: string) => void;
  /** Called when the title input loses focus — persists the title to the server. */
  onTitleBlur?: () => void;
  titleHasError?: boolean;
  onBlocksChange?: (blocks: Block[]) => void;
  /** Called when the user adds or removes a tag on the current page. */
  onTagsChange?: (tags: string[]) => void;
  /** Called when the hamburger button is pressed on mobile. */
  onMobileSidebarToggle?: () => void;
}>;

export function MainContent({
  page,
  breadcrumbs = [],
  onBreadcrumbClick,
  onSave,
  saved = false,
  isDirty = false,
  onTitleChange,
  onTitleBlur,
  titleHasError = false,
  onBlocksChange,
  onTagsChange,
  onMobileSidebarToggle,
}: MainContentProps) {
  const { t } = useI18n();
  const { tagsPerPageEnabled, tagsPerBlockEnabled } = useSettingsStore();

  /**
   * Active block-tag filters.
   *
   * WHY store `{ pageId, tags }` together rather than a plain `string[]`?
   *   We want the filter to reset automatically when the user navigates to a
   *   different page, without using `useEffect` + `setState` (which creates an
   *   extra render cycle). By pairing the tags with the pageId they belong to,
   *   `activeBlockTags` is derived inline: if the stored pageId doesn't match
   *   the current page, it evaluates to `[]` — no effect needed.
   */
  const [blockTagFilter, setBlockTagFilter] = useState<{ pageId: string | undefined; tags: string[] }>(
    { pageId: undefined, tags: [] },
  );
  const pageId = page?.id;
  // Tags are only active for the page they were set on — automatically [] otherwise
  const activeBlockTags = blockTagFilter.pageId === pageId ? blockTagFilter.tags : [];
  const setActiveBlockTags = (tags: string[]) => setBlockTagFilter({ pageId, tags });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        onSave?.();
      }
    };
    globalThis.addEventListener('keydown', handleKeyDown);
    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [onSave]);

  const stats = useMemo(
    () => (page ? computePageStats(page) : null),
    [page],
  );

  /**
   * All unique tags used across all blocks on the current page, sorted
   * alphabetically. Used to populate the block-tag filter strip.
   *
   * WHY derive here instead of inside BlockEditor?
   *   The filter strip lives in MainContent (above BlockEditor), so it needs
   *   the tag list before BlockEditor renders. Deriving here keeps BlockEditor
   *   focused on rendering/editing and avoids prop-drilling back upward.
   */
  const allBlockTags = useMemo(() => {
    if (!page) return [];
    const set = new Set<string>();
    for (const block of page.blocks) {
      for (const tag of block.tags ?? []) set.add(tag);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [page]);

  return (
    <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
      {/* ───── Top header bar ───── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4 shadow-sm md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          {onMobileSidebarToggle && (
            <button
              type="button"
              aria-label={t('sidebar.show')}
              className="mr-1 rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:hidden"
              onClick={onMobileSidebarToggle}
            >
              <Menu size={20} />
            </button>
          )}
          <span className="sr-only">{page?.title ?? t('main.selectPage')}</span>
          {breadcrumbs.length > 0 ? (
            <nav aria-label="Breadcrumb" className="min-w-0">
              <ol className="flex min-w-0 items-center gap-1 text-sm">
                {breadcrumbs.map((crumb, index) => (
                  <li key={crumb.id} className="flex min-w-0 items-center gap-1">
                    {index > 0 && <span className="text-muted-foreground">/</span>}
                    {crumb.isCurrent ? (
                      <span
                        className="min-w-0 truncate rounded px-1 py-0.5 font-medium text-foreground"
                        aria-current="page"
                      >
                        {crumb.label}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={cn(
                          'min-w-0 truncate rounded px-1 py-0.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                        )}
                        onClick={() => onBreadcrumbClick?.(crumb.id)}
                      >
                        {crumb.label}
                      </button>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          ) : (
            <span className="min-w-0 truncate text-sm font-medium text-foreground">
              {page?.title ?? t('main.selectPage')}
            </span>
          )}
        </div>

        {page && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              title={t(I18N_EXPORT_MARKDOWN)}
              aria-label={t(I18N_EXPORT_MARKDOWN)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              onClick={() => downloadMarkdown(page)}
            >
              <Download size={14} />
              <span className="hidden sm:inline">{t(I18N_EXPORT_MARKDOWN)}</span>
            </button>
            <button
              type="button"
              aria-label={t('main.savePage')}
              data-testid="save-page-button"
              className="inline-flex min-w-22 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-card disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
              onClick={onSave}
              disabled={!isDirty}
            >
              <Save size={16} aria-hidden />
              {saved ? t('main.saved') : t('main.save')}
            </button>
          </div>
        )}
      </header>

      {/* ───── Scrollable content area ───── */}
      <div className="flex-1 overflow-y-auto p-3 text-foreground sm:p-6 md:p-8">
        <div className="mx-auto w-full pr-7.5">
          {page ? (
            <div className="flex flex-col gap-4">
              <PageTitle
                page={page}
                readOnly={!onTitleChange}
                onTitleChange={onTitleChange}
                onTitleBlur={onTitleBlur}
                invalid={titleHasError}
              />

              {/* Page-level tag bar — hidden when tagsPerPageEnabled is false */}
              {tagsPerPageEnabled && onTagsChange && (
                <TagBar
                  tags={page.tags ?? []}
                  onChange={onTagsChange}
                />
              )}

              {/* Creation and last-edit timestamps */}
              <PageMeta createdAt={page.createdAt} updatedAt={page.updatedAt} />

              {/* Block tag filter strip — hidden when tagsPerBlockEnabled is false */}
              {tagsPerBlockEnabled && allBlockTags.length > 0 && (
                <BlockTagFilter
                  allTags={allBlockTags}
                  activeTags={activeBlockTags}
                  onChange={setActiveBlockTags}
                  totalBlocks={page.blocks.length}
                  visibleBlocks={
                    activeBlockTags.length === 0
                      ? page.blocks.length
                      : page.blocks.filter((b) =>
                          activeBlockTags.some((t) => (b.tags ?? []).includes(t)),
                        ).length
                  }
                />
              )}

              <BlockEditor
                blocks={page.blocks}
                onChange={onBlocksChange ?? (() => {})}
                filterTags={activeBlockTags.length > 0 ? activeBlockTags : undefined}
                showBlockTags={tagsPerBlockEnabled}
              />

              {stats && stats.blockCount > 0 && (
                <div className="flex flex-wrap items-center gap-4 border-t border-border pt-4 text-xs text-muted-foreground">
                  <span>{t('main.wordCount', { count: stats.wordCount })}</span>
                  <span>·</span>
                  <span>{t('main.readingTime', { min: stats.readingTimeMin })}</span>
                  <span>·</span>
                  <span>{t('main.blockCount', { count: stats.blockCount })}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-card py-16 text-center">
              <p className="text-sm font-medium text-muted-foreground">
                {t('main.emptyHint')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('main.emptyHint2')}
              </p>
            </div>
          )}
        </div>
      </div>

    </main>
  );
}

// ─── TagBar ───────────────────────────────────────────────────────────────────

/**
 * TagBar — inline tag editor shown below the page title.
 *
 * ─── UX DESIGN ────────────────────────────────────────────────────────────────
 *
 * Tags are small, coloured chips. Clicking the × on a chip removes it.
 * At the end of the chip list there is an invisible input: clicking anywhere
 * near the tag area focuses it, then typing + Enter (or comma) adds a tag.
 *
 * WHY comma as a delimiter?
 *   Most users expect comma-separated tags (Gmail, GitHub issues). It also
 *   allows pasting a list like "react, hooks, performance" in one go.
 *
 * WHY lowercase + trim?
 *   Consistent normalisation prevents "React" and "react" being treated as
 *   different tags. Case-insensitive matching is simpler and more forgiving.
 *
 * IMPROVEMENT: Add a tag autocomplete dropdown that suggests existing tags
 * already used across all pages.
 */

const TAG_COLOURS = [
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
];

/**
 * Deterministic colour based on the tag string.
 * Same tag always gets the same colour across the whole app.
 */
function tagColour(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = Math.trunc(hash * 31 + (tag.codePointAt(i) ?? 0));
  return TAG_COLOURS[Math.abs(hash) % TAG_COLOURS.length];
}

type TagBarProps = Readonly<{
  tags: string[];
  onChange: (tags: string[]) => void;
}>;

function TagBar({ tags, onChange }: TagBarProps) {
  const { t } = useI18n();
  const [inputValue, setInputValue] = useState('');
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (raw: string) => {
    const candidates = raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0 && !tags.includes(s));
    if (candidates.length > 0) onChange([...tags, ...candidates]);
    setInputValue('');
  };

  const removeTag = (tag: string) => onChange(tags.filter((t_) => t_ !== tag));

  return (
    /**
     * WHY a div with onMouseDown instead of a <label>?
     *
     * Using <label> without an explicit htmlFor causes the browser to forward
     * clicks to the FIRST interactive descendant — in this case the first tag's
     * "×" button, not the text input. This makes clicking the Tag icon (or any
     * whitespace in the row) accidentally remove the first tag.
     *
     * We explicitly forward clicks to the input via onMouseDown + focus().
     * onMouseDown (not onClick) fires before the blur event on the input,
     * preventing the input from losing focus when clicking tag chips.
     */
    <div
      className="flex cursor-text flex-wrap items-center gap-1.5 rounded-lg border border-transparent py-0.5 focus-within:border-border"
    >
      {/**
       * The Tag icon acts as a visual indicator and a click target to focus the
       * input. We use onClick here (not the label trick) because the div must
       * not carry a role or event handler to satisfy SonarQube's accessibility
       * rules. The icon is the only intentional focus-trigger outside the input.
       */}
      <Tag
        size={13}
        className="shrink-0 cursor-pointer text-muted-foreground/60 hover:text-muted-foreground"
        aria-hidden
        onClick={() => inputRef.current?.focus()}
      />

      {tags.map((tag) => (
        <span
          key={tag}
          className={cn(
            'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
            tagColour(tag),
          )}
        >
          {tag}
          <button
            type="button"
            aria-label={`Remove tag ${tag}`}
            data-testid={`page-tag-remove-${tag}`}
            className="rounded-full opacity-60 hover:opacity-100"
            onClick={() => removeTag(tag)}
          >
            <X size={10} />
          </button>
        </span>
      ))}

      <input
        ref={inputRef}
        id={inputId}
        type="text"
        data-testid="page-tag-input"
        aria-label={t('main.addTag')}
        value={inputValue}
        placeholder={tags.length === 0 ? t('main.addTag') : ''}
        className="min-w-[80px] flex-1 bg-transparent text-xs text-muted-foreground outline-none placeholder:text-muted-foreground/50"
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag(inputValue);
          }
          if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
            removeTag(tags.at(-1) ?? '');
          }
        }}
        onBlur={() => { if (inputValue.trim()) addTag(inputValue); }}
      />
    </div>
  );
}

// ─── BlockTagFilter ───────────────────────────────────────────────────────────

type BlockTagFilterProps = Readonly<{
  /** Every unique tag found across all blocks on this page. */
  allTags: string[];
  /** Currently active (selected) tags. */
  activeTags: string[];
  /** Called when the user toggles a tag or clears all filters. */
  onChange: (tags: string[]) => void;
  /** Total number of blocks on the page. */
  totalBlocks: number;
  /** Number of blocks that match the current filter. */
  visibleBlocks: number;
}>;

/**
 * BlockTagFilter — a compact filter bar shown between the page tag bar and the
 * block editor when at least one block has a tag.
 *
 * Design:
 *   - Each tag is a toggleable chip; active = indigo-filled.
 *   - OR logic: a block is shown if it carries ANY of the active tags.
 *   - When no tags are active all blocks are shown (filter is inactive).
 *   - A "Showing N of M" counter gives immediate feedback on how many blocks
 *     match the current selection.
 *   - A "Clear" button resets all active tags at once.
 *
 * WHY OR logic?
 *   Block tags are free-form annotations ("important", "review", "key-concept").
 *   OR lets users browse all blocks of a given type in one click. AND would
 *   require blocks to be tagged with every selected label, which is too strict
 *   for a general annotation workflow.
 */
function BlockTagFilter({
  allTags,
  activeTags,
  onChange,
  totalBlocks,
  visibleBlocks,
}: BlockTagFilterProps) {
  const { t } = useI18n();
  const isFiltering = activeTags.length > 0;

  const toggle = (tag: string) =>
    onChange(
      activeTags.includes(tag)
        ? activeTags.filter((t) => t !== tag)
        : [...activeTags, tag],
    );

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
      {/* Label */}
      <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Filter size={12} aria-hidden />
        {t('block.filterByTag')}
      </span>

      {/* Tag chips */}
      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        {allTags.map((tag) => {
          const isActive = activeTags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={isActive}
              onClick={() => toggle(tag)}
              className={cn(
                'rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
                isActive
                  ? 'border-indigo-400 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500'
                  : 'border-border bg-card text-muted-foreground hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-300',
              )}
            >
              {tag}
            </button>
          );
        })}
      </div>

      {/* Status + clear */}
      {isFiltering && (
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {t('block.filterCount', { visible: visibleBlocks, total: totalBlocks })}
          </span>
          <button
            type="button"
            onClick={() => onChange([])}
            className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-700 dark:hover:bg-red-950 dark:hover:text-red-400"
            title={t('block.clearFilter')}
          >
            <X size={10} />
            {t('block.clearFilter')}
          </button>
        </div>
      )}
    </div>
  );
}
