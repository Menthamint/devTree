'use client';

/**
 * CodeBlockNode — Monaco-based code editor as a Tiptap node.
 *
 * Attrs: code (string), language (string), tags (string[])
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { useEditable } from '../EditableContext';
import { useTheme } from 'next-themes';
import dynamic from 'next/dynamic';
import { Code2 } from 'lucide-react';
import { BlockTagChips } from '../BlockTagChips';
import { BlockHeader } from '../BlockHeader';
import { BLOCK_ATOM_SPEC, BLOCK_NODE_WRAPPER_CLASS, blockStopEvent } from './nodeUtils';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const LANGUAGES = [
  'javascript', 'typescript', 'python', 'java', 'csharp', 'cpp', 'c',
  'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'sql', 'html', 'css',
  'json', 'yaml', 'markdown', 'bash', 'plaintext',
];

// ─── Node View Component ──────────────────────────────────────────────────────

function CodeBlockNodeView({ node, updateAttributes }: ReactNodeViewProps) {
  const { code, language, tags } = node.attrs as { code: string; language: string; tags: string[] };
  const isEditable = useEditable();
  const { resolvedTheme } = useTheme();
  const monacoTheme = resolvedTheme === 'light' ? 'vs' : 'vs-dark';

  return (
    <NodeViewWrapper className={BLOCK_NODE_WRAPPER_CLASS}>
      <BlockHeader
        icon={<Code2 size={13} className="text-muted-foreground" />}
        title="Code"
        actions={
          isEditable ? (
            <select
              value={language ?? 'javascript'}
              onChange={(e) => updateAttributes({ language: e.target.value })}
              className="rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground outline-none"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          ) : (
            <span className="rounded border border-border bg-background px-2 py-0.5 text-xs text-muted-foreground">
              {language ?? 'javascript'}
            </span>
          )
        }
      />

      {/* Block tags */}
      <BlockTagChips
        tags={tags ?? []}
        isEditable={isEditable}
        onChange={(t) => updateAttributes({ tags: t })}
        showEmpty={isEditable}
      />

      {/* Editor */}
      <div className="min-h-32" onMouseDown={(e) => e.stopPropagation()}>
        <MonacoEditor
          height={Math.max(128, Math.min(600, (code?.split('\n').length ?? 1) * 20 + 32))}
          language={language ?? 'javascript'}
          value={code ?? ''}
          onChange={(val) => isEditable && updateAttributes({ code: val ?? '' })}
          options={{
            readOnly: !isEditable,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            lineNumbers: 'on',
            wordWrap: 'on',
            padding: { top: 8, bottom: 8 },
          }}
          theme={monacoTheme}
        />
      </div>
    </NodeViewWrapper>
  );
}

// ─── Node Definition ──────────────────────────────────────────────────────────

export const CodeBlockNode = Node.create({
  name: 'codeBlockNode',
  ...BLOCK_ATOM_SPEC,

  addAttributes() {
    return {
      code: { default: '' },
      language: { default: 'javascript' },
      tags: { default: [] },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="codeBlockNode"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'codeBlockNode' })];
  },

  addNodeView() {
    // Prevent ProseMirror from intercepting events inside Monaco,
    // but still allow drag events so the GlobalDragHandle works.
    return ReactNodeViewRenderer(CodeBlockNodeView, {
      stopEvent: blockStopEvent,
    });
  },
});
