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
import { useEffect, useId, useRef, useState } from 'react';

import type { Editor } from '@tiptap/core';
import type { JSONContent } from '@tiptap/react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Bookmark,
  Download,
  Edit2,
  Filter,
  Menu,
  Save,
  Search,
  Tag,
  X,
  XCircle,
} from 'lucide-react';

import { BookmarksPanel } from '@/components/features/editor/BookmarksPanel';
import { EditorToolbar } from '@/components/features/editor/EditorToolbar';
import { PageEditor } from '@/components/features/editor/PageEditor';
import { useI18n } from '@/lib/i18n';
import { downloadMarkdown, extractInlineTagsFromContent } from '@/lib/pageUtils';
import { useSettingsStore } from '@/lib/settingsStore';
import { cn } from '@/lib/utils';

import { PageMeta } from './PageMeta';
import { PageTitle } from './PageTitle';
import type { Page } from './types';

const I18N_EXPORT_MARKDOWN = 'main.exportMarkdown';

type MainContentProps = Readonly<{
  page: Page | null;
  isPageLoading?: boolean;
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
  /** Called when the user adds or removes a tag on the current page. */
  onTagsChange?: (tags: string[]) => void;
  /** All unique tags from every page — used for autocomplete in the tag bar. */
  allTagSuggestions?: string[];
  /** Called when the hamburger button is pressed on mobile. */
  onMobileSidebarToggle?: () => void;
  // ── Unified editor edit-mode ──────────────────────────────────────────────
  /** True when the page is in active editing mode. */
  isEditMode?: boolean;
  onEditModeChange?: (v: boolean) => void;
  /** Called by PageEditor for every document change in edit mode. */
  onContentChange?: (json: JSONContent) => void;
}>;
export function MainContent({
  page,
  isPageLoading = false,
  breadcrumbs = [],
  onBreadcrumbClick,
  onSave,
  saved = false,
  isDirty = false,
  onTitleChange,
  onTitleBlur,
  titleHasError = false,
  onTagsChange,
  allTagSuggestions = [],
  onMobileSidebarToggle,
  isEditMode = false,
  onEditModeChange,
  onContentChange,
}: MainContentProps) {
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  const { tagsPerPageEnabled, tagsPerBlockEnabled } = useSettingsStore();

  /** Editor instance forwarded from PageEditor — used to render the toolbar here */
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);

  /** Active inline-tag filter — tags clicked in the per-page tag filter bar. */
  const [activeFilterTags, setActiveFilterTags] = useState<string[]>([]);
  /** All inline tags extracted from the current page's Tiptap content. */
  const [pageInlineTags, setPageInlineTags] = useState<string[]>([]);

  const updateInlineTagsIfChanged = (nextTags: string[]) => {
    setPageInlineTags((prev) => {
      if (prev.length === nextTags.length && prev.every((tag, index) => tag === nextTags[index])) {
        return prev;
      }
      return nextTags;
    });
  };

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

  // ── Extract inline tags — from page.content immediately, then live from editor
  // Primary: derive directly from the stored JSON so tags are visible before
  // the Tiptap instance fires its first 'update' event.
  useEffect(() => {
    if (!page?.content) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset page tag list when content is absent
      setPageInlineTags([]);
      return;
    }
    const extracted = extractInlineTagsFromContent(page.content as Record<string, unknown>);
    updateInlineTagsIfChanged(extracted);
  }, [page?.content, page?.id]);

  // Secondary: keep in sync while editing (editor fires 'update' on every change).
  useEffect(() => {
    if (!editorInstance) return;
    const update = () => {
      const json = editorInstance.getJSON();
      const extracted = extractInlineTagsFromContent(json as Record<string, unknown>);
      updateInlineTagsIfChanged(extracted);
    };
    update();
    editorInstance.on('update', update);
    return () => {
      editorInstance.off('update', update);
    };
  }, [editorInstance]);

  // ── Reset filter when page changes ───────────────────────────────────────
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset active tag filter on page switch
    setActiveFilterTags([]);
  }, [page?.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- collapse bookmarks on page switch
    setBookmarksOpen(false);
  }, [page?.id]);

  useEffect(() => {
    if (isEditMode) {
      setActiveFilterTags([]);
    }
  }, [isEditMode]);

  let headerTitleNode: React.ReactNode;
  if (isPageLoading) {
    headerTitleNode = (
      <div
        data-testid="main-content-header-skeleton"
        className="bg-muted h-5 w-56 animate-pulse rounded-md"
      />
    );
  } else if (breadcrumbs.length > 0) {
    headerTitleNode = (
      <nav aria-label="Breadcrumb" className="min-w-0" data-testid="page-header-title">
        <ol className="flex min-w-0 items-center gap-1 text-sm">
          {breadcrumbs.map((crumb, index) => (
            <li key={crumb.id} className="flex min-w-0 items-center gap-1">
              {index > 0 && <span className="text-muted-foreground">/</span>}
              {crumb.isCurrent ? (
                <span
                  className="text-foreground min-w-0 truncate rounded px-1 py-0.5 font-medium"
                  aria-current="page"
                >
                  {crumb.label}
                </span>
              ) : (
                <button
                  type="button"
                  className={cn(
                    'text-muted-foreground hover:bg-accent hover:text-accent-foreground min-w-0 truncate rounded px-1 py-0.5',
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
    );
  } else {
    headerTitleNode = (
      <span
        className="text-foreground min-w-0 truncate text-sm font-medium"
        data-testid="page-header-title"
      >
        {page?.title ?? t('main.selectPage')}
      </span>
    );
  }

  let pageBodyNode: React.ReactNode;
  if (isPageLoading) {
    pageBodyNode = <NotebookPageSkeleton />;
  } else if (page) {
    pageBodyNode = (
      <div className="flex flex-col gap-4">
        <PageTitle
          page={page}
          readOnly={!isEditMode}
          onTitleChange={isEditMode ? onTitleChange : undefined}
          onTitleBlur={isEditMode ? onTitleBlur : undefined}
          invalid={titleHasError}
        />

        {/* Page-level tag bar — always visible; editable only in edit mode */}
        {tagsPerPageEnabled && (
          <TagBar
            tags={page.tags ?? []}
            isEditable={isEditMode}
            suggestions={allTagSuggestions}
            onChange={onTagsChange ?? (() => {})}
          />
        )}

        {/* Creation and last-edit timestamps */}
        <PageMeta createdAt={page.createdAt} updatedAt={page.updatedAt} />

        {/* Per-page inline tag filter — always shown when the feature is enabled */}
        {tagsPerBlockEnabled && !isEditMode && (
          <BlockTagFilter
            allTags={pageInlineTags}
            activeTags={activeFilterTags}
            onChange={setActiveFilterTags}
            totalBlocks={pageInlineTags.length}
            visibleBlocks={
              activeFilterTags.length > 0 ? activeFilterTags.length : pageInlineTags.length
            }
          />
        )}

        {/* Unified Tiptap editor */}
        <PageEditor
          content={page.content ?? null}
          editable={isEditMode}
          onChange={onContentChange}
          pageId={page.id}
          onEditorReady={setEditorInstance}
          activeFilterTags={isEditMode ? [] : activeFilterTags}
        />
      </div>
    );
  } else {
    pageBodyNode = (
      <div className="border-border bg-card flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16 text-center">
        <p className="text-muted-foreground text-sm font-medium">{t('main.emptyHint')}</p>
        <p className="text-muted-foreground mt-1 text-xs">{t('main.emptyHint2')}</p>
      </div>
    );
  }

  return (
    <main className="bg-background text-foreground flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      {/* ───── Top header bar ───── */}
      <motion.header
        key={`main-header-${page?.id ?? 'empty'}`}
        className="alive-surface border-border bg-card flex h-14 shrink-0 items-center justify-between border-b px-4 shadow-sm md:px-6"
        initial={reducedMotion ? false : { y: -14, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={
          reducedMotion
            ? { duration: 0.01 }
            : { type: 'spring', stiffness: 360, damping: 30, mass: 0.82 }
        }
      >
        <div className="flex min-w-0 items-center gap-2">
          {onMobileSidebarToggle && (
            <button
              type="button"
              aria-label={t('sidebar.show')}
              className="motion-interactive icon-tilt-hover text-muted-foreground hover:bg-accent hover:text-accent-foreground mr-1 rounded p-1.5 transition-colors md:hidden"
              onClick={onMobileSidebarToggle}
            >
              <Menu size={20} />
            </button>
          )}
          <span className="sr-only">{page?.title ?? t('main.selectPage')}</span>
          {headerTitleNode}
        </div>

        {page && !isPageLoading && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              data-testid="export-markdown-button"
              title={t(I18N_EXPORT_MARKDOWN)}
              aria-label={t(I18N_EXPORT_MARKDOWN)}
              className="motion-interactive icon-pop-hover border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
              onClick={() => downloadMarkdown(page)}
            >
              <Download size={14} />
              <span className="hidden sm:inline">{t(I18N_EXPORT_MARKDOWN)}</span>
            </button>

            {editorInstance && (
              <div className="relative">
                <button
                  type="button"
                  title="Bookmarks"
                  aria-label="Bookmarks"
                  className="motion-interactive icon-pop-hover border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
                  onClick={() => setBookmarksOpen((v) => !v)}
                >
                  <Bookmark size={14} />
                  <span className="hidden sm:inline">Bookmarks</span>
                </button>

                <AnimatePresence>
                  {bookmarksOpen && (
                    <>
                      <motion.div
                        key="bookmarks-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: reducedMotion ? 0.01 : 0.18, ease: 'easeOut' }}
                        className="fixed inset-0 z-10"
                        aria-hidden
                        onClick={() => setBookmarksOpen(false)}
                      />
                      <motion.div
                        key="bookmarks-panel"
                        initial={
                          reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.97 }
                        }
                        animate={
                          reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }
                        }
                        exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
                        transition={{ duration: reducedMotion ? 0.01 : 0.2, ease: [0.22, 1, 0.36, 1] }}
                        className="absolute top-full right-0 z-20 mt-1"
                      >
                        <BookmarksPanel
                          editor={editorInstance}
                          onClose={() => setBookmarksOpen(false)}
                        />
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Edit-mode toggle — Edit/Save/Cancel */}
            {isEditMode ? (
              <>
                <button
                  type="button"
                  aria-label="Cancel editing"
                  className="motion-interactive icon-spin-hover border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors"
                  onClick={() => onEditModeChange?.(false)}
                >
                  <XCircle size={15} aria-hidden />
                  <span className="hidden sm:inline">Cancel</span>
                </button>
                <button
                  type="button"
                  aria-label={t('main.savePage')}
                  data-testid="save-page-button"
                  className="motion-interactive icon-pop-hover focus:ring-offset-card inline-flex min-w-22 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
                  onClick={onSave}
                  disabled={!isDirty}
                >
                  <Save size={16} aria-hidden />
                  {saved ? t('main.saved') : t('main.save')}
                </button>
              </>
            ) : (
              <button
                type="button"
                aria-label="Edit page"
                className="motion-interactive icon-pop-hover focus:ring-offset-card inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none dark:bg-indigo-500 dark:hover:bg-indigo-600"
                onClick={() => onEditModeChange?.(true)}
              >
                <Edit2 size={15} aria-hidden />
                <span className="hidden sm:inline">Edit</span>
              </button>
            )}
          </div>
        )}
      </motion.header>

      {/* ───── Formatting toolbar — shown as a second bar when editing ───── */}
      {isEditMode && editorInstance && (
        <div className="border-border bg-card/95 supports-backdrop-filter:bg-card/60 shrink-0 border-b backdrop-blur">
          <EditorToolbar editor={editorInstance} blockId={page?.id} />
        </div>
      )}

      {/* ───── Scrollable content area ───── */}
      <div className="text-foreground flex-1 overflow-y-auto py-3 sm:py-6 md:py-8">
        <div className="mx-auto w-full px-3 pr-7.5 sm:px-6 md:px-8">{pageBodyNode}</div>
      </div>
    </main>
  );
}

function NotebookPageSkeleton() {
  return (
    <div
      className="flex flex-col gap-4"
      data-testid="main-content-page-skeleton"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="bg-muted h-10 w-2/3 animate-pulse rounded-lg" />
      <div className="bg-muted h-7 w-80 animate-pulse rounded-lg" />
      <div className="bg-muted h-5 w-56 animate-pulse rounded-md" />
      <div className="space-y-3">
        <div className="bg-muted h-5 w-full animate-pulse rounded-md" />
        <div className="bg-muted h-5 w-full animate-pulse rounded-md" />
        <div className="bg-muted h-5 w-5/6 animate-pulse rounded-md" />
        <div className="bg-muted h-5 w-full animate-pulse rounded-md" />
        <div className="bg-muted h-5 w-4/5 animate-pulse rounded-md" />
      </div>
    </div>
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
  /**
   * When false the bar is read-only: chips are shown but the input and ×
   * remove buttons are hidden. Defaults to true.
   */
  isEditable?: boolean;
  /**
   * All unique tags from the workspace used for autocomplete suggestions.
   */
  suggestions?: string[];
}>;

function TagBar({ tags, onChange, isEditable = true, suggestions = [] }: TagBarProps) {
  const { t } = useI18n();
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);

  // Suggestions filtered by current input, excluding already-added tags
  const filteredSuggestions = suggestions.filter(
    (s) => s.toLowerCase().includes(inputValue.toLowerCase()) && !tags.includes(s),
  );

  const addTag = (raw: string) => {
    const candidates = raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0 && !tags.includes(s));
    if (candidates.length > 0) onChange([...tags, ...candidates]);
    setInputValue('');
    setShowSuggestions(false);
  };

  const removeTag = (tag: string) => onChange(tags.filter((t_) => t_ !== tag));

  // Read-only view — just chips, no input
  if (!isEditable) {
    if (tags.length === 0) return null;
    return (
      <div className="flex flex-wrap items-center gap-1.5 py-0.5">
        <Tag size={13} className="text-muted-foreground/60 shrink-0" aria-hidden />
        {tags.map((tag) => (
          <span
            key={tag}
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
              tagColour(tag),
            )}
          >
            {tag}
          </span>
        ))}
      </div>
    );
  }

  return (
    /**
     * WHY a div with onMouseDown instead of a <label>?
     *
     * Using <label> without an explicit htmlFor causes the browser to forward
     * clicks to the FIRST interactive descendant — in this case the first tag's
     * "×" button, not the text input. This makes clicking the Tag icon (or any
     * whitespace in the row) accidentally remove the first tag.
     *
     * We explicitly forward clicks to the input via onClick + focus().
     */
    <div className="focus-within:border-border relative flex flex-wrap items-center gap-1.5 rounded-lg border border-transparent py-0.5">
      <Tag
        size={13}
        className="text-muted-foreground/60 hover:text-muted-foreground shrink-0 cursor-pointer"
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
            className="motion-interactive icon-spin-hover rounded-full opacity-60 hover:opacity-100"
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
        className="text-muted-foreground placeholder:text-muted-foreground/50 min-w-20 flex-1 bg-transparent text-xs outline-none"
        onChange={(e) => {
          setInputValue(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            addTag(inputValue);
          }
          if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
            removeTag(tags.at(-1) ?? '');
          }
          if (e.key === 'Escape') setShowSuggestions(false);
        }}
        onBlur={(e) => {
          // Don't close if clicking inside the suggestions list
          if (suggestionsRef.current?.contains(e.relatedTarget as Node)) return;
          if (inputValue.trim()) addTag(inputValue);
          else setShowSuggestions(false);
        }}
      />

      {/* Autocomplete suggestions dropdown */}
      {showSuggestions && filteredSuggestions.length > 0 && (
        <ul
          ref={suggestionsRef}
          aria-label="Tag suggestions"
          className="border-border bg-popover absolute top-full left-0 z-50 mt-1 max-h-40 w-48 overflow-y-auto rounded-lg border py-1 shadow-md"
        >
          {filteredSuggestions.slice(0, 20).map((s) => (
            <li key={s}>
              <button
                type="button"
                className="text-foreground hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs"
                onMouseDown={(e) => {
                  e.preventDefault(); // don't blur the input
                  addTag(s);
                  inputRef.current?.focus();
                }}
              >
                <span className={cn('h-2 w-2 shrink-0 rounded-full', tagColour(s).split(' ')[0])} />
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
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
  const [searchQuery, setSearchQuery] = useState('');
  const isFiltering = activeTags.length > 0;

  const visibleTags = searchQuery.trim()
    ? allTags.filter((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    : allTags;

  const toggle = (tag: string) =>
    onChange(activeTags.includes(tag) ? activeTags.filter((t) => t !== tag) : [...activeTags, tag]);

  return (
    <div className="border-border bg-muted/30 flex flex-col gap-2 rounded-lg border px-3 py-2">
      {/* Header row: label + search + clear */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs font-medium">
          <Filter size={12} aria-hidden />
          {t('block.filterByTag')}
        </span>

        {/* Search input */}
        <div className="border-border bg-background flex min-w-28 flex-1 items-center gap-1 rounded-md border px-2 py-0.5">
          <Search size={11} className="text-muted-foreground/60 shrink-0" aria-hidden />
          <input
            type="text"
            aria-label="Search tags"
            placeholder="Search tags…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="text-foreground placeholder:text-muted-foreground/50 min-w-0 flex-1 bg-transparent text-xs outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              className="motion-interactive icon-spin-hover text-muted-foreground/60 hover:text-muted-foreground shrink-0"
              onClick={() => setSearchQuery('')}
            >
              <X size={10} />
            </button>
          )}
        </div>

        {/* Status + clear filter */}
        {isFiltering && (
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-muted-foreground text-xs">
              {t('block.filterCount', { visible: visibleBlocks, total: totalBlocks })}
            </span>
            <button
              type="button"
              onClick={() => onChange([])}
              className="motion-interactive icon-spin-hover border-border text-muted-foreground flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-700 dark:hover:bg-red-950 dark:hover:text-red-400"
              title={t('block.clearFilter')}
            >
              <X size={10} />
              {t('block.clearFilter')}
            </button>
          </div>
        )}
      </div>

      {/* Tag chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {visibleTags.length === 0 ? (
          <span className="text-muted-foreground/60 text-xs">
            No tags match &ldquo;{searchQuery}&rdquo;
          </span>
        ) : (
          visibleTags.map((tag) => {
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
          })
        )}
      </div>
    </div>
  );
}
