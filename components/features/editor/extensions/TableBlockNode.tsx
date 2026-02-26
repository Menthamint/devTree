'use client';

/**
 * TableBlockNode — spreadsheet-style table as a Tiptap node.
 *
 * Attrs: headers (string[]), rows (string[][]), tags (string[])
 */
import { mergeAttributes, Node } from '@tiptap/core';
import { NodeViewWrapper, type ReactNodeViewProps, ReactNodeViewRenderer } from '@tiptap/react';
import { Plus, Table, Trash2 } from 'lucide-react';

import { BlockHeader } from '../BlockHeader';
import { BlockTagChips } from '../BlockTagChips';
import { useEditable } from '../EditableContext';
import { BLOCK_ATOM_SPEC, BLOCK_NODE_WRAPPER_CLASS, blockStopEvent } from './nodeUtils';

// ─── Node View ────────────────────────────────────────────────────────────────

function TableBlockNodeView({ node, updateAttributes }: ReactNodeViewProps) {
  const { headers, rows, tags } = node.attrs as {
    headers: string[];
    rows: string[][];
    tags: string[];
  };
  const isEditable = useEditable();
  const safeHeaders: string[] = Array.isArray(headers) ? headers : ['Column 1'];
  const safeRows: string[][] = Array.isArray(rows) ? rows : [];

  const updateHeader = (col: number, val: string) => {
    const next = [...safeHeaders];
    next[col] = val;
    updateAttributes({ headers: next });
  };

  const updateCell = (row: number, col: number, val: string) => {
    const next = safeRows.map((r) => [...r]);
    if (!next[row]) next[row] = [];
    next[row][col] = val;
    updateAttributes({ rows: next });
  };

  const addColumn = () => {
    updateAttributes({
      headers: [...safeHeaders, `Column ${safeHeaders.length + 1}`],
      rows: safeRows.map((r) => [...r, '']),
    });
  };

  const removeColumn = (col: number) => {
    updateAttributes({
      headers: safeHeaders.filter((_, i) => i !== col),
      rows: safeRows.map((r) => r.filter((_, i) => i !== col)),
    });
  };

  const addRow = () => {
    updateAttributes({ rows: [...safeRows, safeHeaders.map(() => '')] });
  };

  const removeRow = (row: number) => {
    updateAttributes({ rows: safeRows.filter((_, i) => i !== row) });
  };

  return (
    <NodeViewWrapper className={BLOCK_NODE_WRAPPER_CLASS}>
      <BlockHeader
        icon={<Table size={13} className="text-muted-foreground" />}
        title="Table"
        actions={
          isEditable && (
            <button
              type="button"
              aria-label="Add column"
              onClick={addColumn}
              className="motion-interactive icon-pop-hover text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
            >
              <Plus size={11} /> Column
            </button>
          )
        }
      />

      {/* Tags */}
      <BlockTagChips
        tags={tags ?? []}
        isEditable={isEditable}
        onChange={(t) => updateAttributes({ tags: t })}
        showEmpty={isEditable}
      />

      {/* Table */}
      <div className="overflow-x-auto" onMouseDown={(e) => e.stopPropagation()}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-border bg-muted/20 border-b">
              {safeHeaders.map((h, col) => (
                <th key={col} className="text-foreground relative px-3 py-2 text-left font-medium">
                  {isEditable ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={h}
                        className="text-foreground flex-1 bg-transparent font-medium outline-none"
                        onChange={(e) => updateHeader(col, e.target.value)}
                      />
                      {safeHeaders.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeColumn(col)}
                          className="motion-interactive icon-spin-hover text-muted-foreground/40 hover:text-destructive"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  ) : (
                    h
                  )}
                </th>
              ))}
              {isEditable && <th className="w-8" />}
            </tr>
          </thead>
          <tbody>
            {safeRows.map((row, rowIdx) => (
              <tr key={rowIdx} className="border-border hover:bg-muted/20 border-b last:border-0">
                {safeHeaders.map((_, col) => (
                  <td key={col} className="text-muted-foreground px-3 py-2">
                    {isEditable ? (
                      <input
                        type="text"
                        value={row[col] ?? ''}
                        className="text-foreground w-full bg-transparent outline-none"
                        onChange={(e) => updateCell(rowIdx, col, e.target.value)}
                      />
                    ) : (
                      <span>{row[col] || '—'}</span>
                    )}
                  </td>
                ))}
                {isEditable && (
                  <td className="w-8 px-1 py-2">
                    <button
                      type="button"
                      onClick={() => removeRow(rowIdx)}
                      className="motion-interactive icon-spin-hover text-muted-foreground/40 hover:text-destructive"
                    >
                      <Trash2 size={11} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add row */}
      {isEditable && (
        <div className="border-border border-t px-3 py-1.5">
          <button
            type="button"
            onClick={addRow}
            className="motion-interactive icon-pop-hover text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-xs"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Plus size={11} /> Add row
          </button>
        </div>
      )}
    </NodeViewWrapper>
  );
}

// ─── Node Definition ──────────────────────────────────────────────────────────

export const TableBlockNode = Node.create({
  name: 'tableBlockNode',
  ...BLOCK_ATOM_SPEC,

  addAttributes() {
    return {
      headers: { default: ['Column 1', 'Column 2'] },
      rows: { default: [] },
      tags: { default: [] },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="tableBlockNode"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'tableBlockNode' })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(TableBlockNodeView, {
      stopEvent: blockStopEvent,
    });
  },
});
