'use client';

/**
 * BlockTagChips — reusable inline tag editor for block node views.
 *
 * Shows tag chips; in edit mode allows adding/removing tags.
 */

import { useRef, useState } from 'react';
import { X, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/lib/settingsStore';

const TAG_COLOURS = [
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
];

function tagColour(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = Math.trunc(hash * 31 + (tag.codePointAt(i) ?? 0));
  return TAG_COLOURS[Math.abs(hash) % TAG_COLOURS.length];
}

type BlockTagChipsProps = {
  tags: string[];
  isEditable: boolean;
  onChange: (tags: string[]) => void;
  /** When true, render even if tags is empty (so user can add tags in edit mode) */
  showEmpty?: boolean;
};

export function BlockTagChips({ tags, isEditable, onChange, showEmpty }: BlockTagChipsProps) {
  const { tagsPerBlockEnabled } = useSettingsStore();
  const [inputVal, setInputVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  if (!tagsPerBlockEnabled) return null;
  if (!showEmpty && tags.length === 0 && !isEditable) return null;
  if (!showEmpty && !isEditable && tags.length === 0) return null;
  // In view mode show nothing if no tags
  if (!isEditable && tags.length === 0) return null;

  const addTag = (raw: string) => {
    const candidates = raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0 && !tags.includes(s));
    if (candidates.length > 0) onChange([...tags, ...candidates]);
    setInputVal('');
  };

  const removeTag = (tag: string) => onChange(tags.filter((t) => t !== tag));

  return (
    <div
      className="flex flex-wrap items-center gap-1 border-b border-border px-3 py-1.5"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Tag size={11} className="shrink-0 text-muted-foreground/60" aria-hidden />
      {tags.map((tag) => (
        <span
          key={tag}
          className={cn('flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium', tagColour(tag))}
        >
          {tag}
          {isEditable && (
            <button
              type="button"
              aria-label={`Remove tag ${tag}`}
              className="rounded-full opacity-70 hover:opacity-100"
              onClick={() => removeTag(tag)}
            >
              <X size={9} />
            </button>
          )}
        </span>
      ))}
      {isEditable && (
        <input
          ref={inputRef}
          type="text"
          aria-label="Add tag"
          value={inputVal}
          placeholder={tags.length === 0 ? 'Add tag…' : ''}
          className="min-w-[60px] flex-1 bg-transparent text-xs text-muted-foreground outline-none placeholder:text-muted-foreground/50"
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(inputVal); }
            if (e.key === 'Backspace' && inputVal === '' && tags.length > 0) removeTag(tags.at(-1) ?? '');
          }}
          onBlur={() => { if (inputVal.trim()) addTag(inputVal); }}
        />
      )}
    </div>
  );
}
