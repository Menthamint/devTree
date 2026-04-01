'use client';
import { useState } from 'react';

import type { JSONContent } from '@tiptap/core';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/shared/ui/dialog';
import { useI18n } from '@/lib/i18n';

import {
  decodeTemplateText,
  extractTextFromContent,
  isLegacyTemplateBody,
  parseTemplateBodyToJson,
  stripNonEditableAttrs,
  templateBodyToContent,
} from './diaryUtils';
import { TemplateBodyEditor } from './TemplateBodyEditor';
import type { DiaryTemplate } from './types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: DiaryTemplate[];
  loadingTemplates: boolean;
  onCreate: (name: string, body: string) => Promise<DiaryTemplate | null>;
  onUpdate: (id: string, name: string, body: string) => Promise<DiaryTemplate | null>;
  onDelete: (id: string) => Promise<boolean>;
};

const primaryButtonClass =
  'bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors disabled:opacity-60';

function getPreviewText(body: string): string {
  if (isLegacyTemplateBody(body)) return decodeTemplateText(body);
  const parsed = parseTemplateBodyToJson(body);
  return parsed ? extractTextFromContent(parsed) : '';
}

export function DiaryTemplateManagerDialog({
  open,
  onOpenChange,
  templates,
  loadingTemplates,
  onCreate,
  onUpdate,
  onDelete,
}: Readonly<Props>) {
  const { t } = useI18n();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [bodyContent, setBodyContent] = useState<JSONContent | null>(null);
  const resetForm = () => {
    setEditingId(null);
    setNameInput('');
    setBodyContent(null);
  };

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) resetForm();
  };

  const handleSubmit = async () => {
    const name = nameInput.trim();
    const body = bodyContent ? JSON.stringify(bodyContent) : '';
    if (!name || !body) return;

    if (editingId) {
      await onUpdate(editingId, name, body);
    } else {
      await onCreate(name, body);
    }
    resetForm();
  };

  const handleEdit = (template: DiaryTemplate) => {
    const parsed = parseTemplateBodyToJson(template.body);
    const raw = parsed ?? templateBodyToContent(template.body);
    const initialContent = stripNonEditableAttrs(raw);
    setEditingId(template.id);
    setNameInput(template.name);
    setBodyContent(initialContent);
  };

  const handleDelete = async (id: string) => {
    await onDelete(id);
    if (editingId === id) resetForm();
  };

  const isSubmitDisabled =
    !nameInput.trim() || !bodyContent || extractTextFromContent(bodyContent).length === 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-2xl"
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('diary.templateManagerTitle')}</DialogTitle>
          <DialogDescription>{t('diary.templateManagerDescription')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder={t('diary.templateNamePlaceholder')}
              className="border-border bg-background focus:ring-ring h-10 w-full rounded-md border px-3 text-sm focus:ring-2 focus:outline-none"
            />
            <TemplateBodyEditor
              content={bodyContent}
              onChange={setBodyContent}
              placeholder={t('diary.templateBodyPlaceholder')}
            />
            <p className="text-muted-foreground text-xs">{t('diary.templateHint')}</p>
          </div>

          <div className="flex justify-end gap-2">
            {editingId && (
              <button
                type="button"
                className="border-border hover:bg-accent rounded-md border px-3 py-2 text-sm"
                onClick={resetForm}
              >
                {t('diary.cancelEditTemplate')}
              </button>
            )}
            <button
              type="button"
              className={primaryButtonClass}
              onClick={() => {
                void handleSubmit();
              }}
              disabled={isSubmitDisabled}
            >
              {editingId ? t('diary.updateTemplate') : t('diary.createTemplate')}
            </button>
          </div>

          <div className="border-border max-h-56 space-y-2 overflow-y-auto rounded-md border p-2">
            {loadingTemplates && (
              <p className="text-muted-foreground px-2 py-1 text-sm">
                {t('diary.loadingTemplates')}
              </p>
            )}
            {!loadingTemplates && templates.length === 0 && (
              <p className="text-muted-foreground px-2 py-1 text-sm">{t('diary.noTemplates')}</p>
            )}
            {templates.map((template) => (
              <div
                key={template.id}
                className="border-border bg-card/70 flex items-center justify-between gap-2 rounded-md border p-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{template.name}</p>
                  <p className="text-muted-foreground line-clamp-2 text-xs">
                    {getPreviewText(template.body)}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="border-border hover:bg-accent rounded-md border px-2 py-1 text-xs"
                    onClick={() => handleEdit(template)}
                  >
                    {t('diary.editTemplate')}
                  </button>
                  <button
                    type="button"
                    className="border-border hover:bg-accent rounded-md border px-2 py-1 text-xs"
                    onClick={() => {
                      void handleDelete(template.id);
                    }}
                  >
                    {t('delete.delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
