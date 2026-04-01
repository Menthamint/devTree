'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

import type { JSONContent } from '@tiptap/core';
import type { Editor } from '@tiptap/react';
import { CalendarDays, Plus } from 'lucide-react';
import { useReducedMotion } from 'motion/react';

import { EditorToolbar } from '@/components/features/editor/EditorToolbar';
import { PageEditor } from '@/components/features/editor/PageEditor';
import { UnsavedChangesDialog } from '@/components/features/Workspace/UnsavedChangesDialog';
import { Sidebar } from '@/components/shared/Sidebar';
import { useConfirmation } from '@/lib/confirmationContext';
import { useI18n } from '@/lib/i18n';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { cn } from '@/lib/utils';

import { DiaryCreateEntryDialog } from './DiaryCreateEntryDialog';
import { DiaryHeader } from './DiaryHeader';
import { DiarySidebarContent } from './DiarySidebarContent';
import { DiaryTemplateManagerDialog } from './DiaryTemplateManagerDialog';
import {
  isLegacyTemplateBody,
  parseTemplateBodyToJson,
  templateBodyToContent,
  templateJsonToContent,
  toDateOnly,
} from './diaryUtils';
import { useDiaryEntries } from './hooks/useDiaryEntries';
import { useDiaryJournals } from './hooks/useDiaryJournals';
import { useDiaryTemplates } from './hooks/useDiaryTemplates';
import type { DiaryTemplate } from './types';

export default function DiaryPageClient() {
  const { status } = useSession();
  const router = useRouter();
  const { t, locale } = useI18n();
  const { confirm } = useConfirmation();
  const { diaryTemperatureUnit } = useSettingsStore();
  const dateLocale = locale === 'uk' ? 'uk-UA' : 'en-US';

  const today = useMemo(() => toDateOnly(new Date()), []);
  const reducedMotion = useReducedMotion();
  const sidebarTransition = reducedMotion
    ? { duration: 0.01 }
    : { duration: 0.34, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] };

  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [monthCursor, setMonthCursor] = useState<Date>(() => new Date());
  const [editor, setEditor] = useState<Editor | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [mobileSidebarVisible, setMobileSidebarVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTemplateManagerDialog, setShowTemplateManagerDialog] = useState(false);
  const [createDateValue, setCreateDateValue] = useState(today);
  const pendingActionRef = useRef<(() => void) | null>(null);

  const {
    journals,
    activeJournalId,
    setActiveJournalId,
    activeJournal,
    fetchJournals,
    createJournal,
    renameJournal,
    error: journalError,
  } = useDiaryJournals();

  const diaryQuery = useMemo(
    () => (activeJournalId ? `?journalId=${encodeURIComponent(activeJournalId)}` : ''),
    [activeJournalId],
  );

  const {
    entries,
    entriesByDate,
    groupedEntries,
    selectedDate,
    content,
    isDirty,
    saveState,
    loadingList,
    loadingEntry,
    creatingEntry,
    error: entryError,
    resetToEmpty,
    fetchEntries,
    loadEntry,
    saveCurrentEntry,
    createEntryNow,
    deleteEntryByDate,
    handleContentChange,
    setIsDirty,
    setSaveState,
    setContent,
  } = useDiaryEntries(activeJournalId, diaryQuery, today, dateLocale);

  const {
    templates,
    loadingTemplates,
    fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  } = useDiaryTemplates(activeJournalId);

  const selectedEntryExists = selectedDate ? Boolean(entriesByDate[selectedDate]) : false;
  const todayEntryExists = Boolean(entriesByDate[today]);
  const effectiveVisible = isMobile ? mobileSidebarVisible : sidebarVisible;

  const selectedWeatherSummary = useMemo(() => {
    if (!selectedDate) return null;
    const entry = entriesByDate[selectedDate];
    if (!entry) return null;
    if (typeof entry.weatherTempC !== 'number' || typeof entry.weatherCode !== 'number')
      return null;
    return {
      tempC: entry.weatherTempC,
      weatherCode: entry.weatherCode,
      weatherLabel: entry.weatherLabel ?? '',
      locationName: entry.locationName ?? '',
      locationShort: entry.locationShort ?? entry.locationName ?? '',
      locationLat: entry.locationLat,
      locationLon: entry.locationLon,
    };
  }, [entriesByDate, selectedDate]);

  const requestWithUnsavedGuard = useCallback(
    (action: () => void) => {
      if (!isDirty) {
        action();
        return;
      }
      pendingActionRef.current = action;
      setShowUnsavedDialog(true);
    },
    [isDirty],
  );

  const createEntryForDate = useCallback(
    (dateOnly: string) => {
      requestWithUnsavedGuard(() => {
        void createEntryNow(dateOnly);
      });
    },
    [createEntryNow, requestWithUnsavedGuard],
  );

  const handleSelectDate = useCallback(
    (dateOnly: string) => {
      if (dateOnly === selectedDate) return;
      requestWithUnsavedGuard(() => {
        void loadEntry(dateOnly);
      });
    },
    [loadEntry, requestWithUnsavedGuard, selectedDate],
  );

  const handleDeleteEntry = useCallback(
    async (dateOnly: string) => {
      const confirmed = await confirm({
        title: t('diary.deleteTitle'),
        description: t('diary.deleteDescription'),
        confirmText: t('delete.delete'),
        cancelText: t('delete.cancel'),
        variant: 'destructive',
        tone: 'destructive',
      });
      if (confirmed) {
        void deleteEntryByDate(dateOnly, selectedDate);
      }
    },
    [confirm, t, deleteEntryByDate, selectedDate],
  );

  const applyTemplate = useCallback(
    async (template: DiaryTemplate) => {
      if (isDirty) {
        const confirmed = await confirm({
          title: t('diary.applyTemplateOverwriteTitle'),
          description: t('diary.applyTemplateOverwriteDescription'),
          confirmText: t('diary.applyTemplate'),
          cancelText: t('delete.cancel'),
        });
        if (!confirmed) return;
      }
      let nextContent: JSONContent;
      if (isLegacyTemplateBody(template.body)) {
        nextContent = templateBodyToContent(template.body);
      } else {
        const parsed = parseTemplateBodyToJson(template.body);
        nextContent = parsed ? templateJsonToContent(parsed) : templateBodyToContent(template.body);
      }
      setContent(nextContent);
      setIsDirty(true);
      setSaveState('idle');
    },
    [isDirty, confirm, t, setContent, setIsDirty, setSaveState],
  );

  const handleSaveAndLeave = async () => {
    const ok = await saveCurrentEntry(selectedDate, content);
    if (!ok) return;
    setShowUnsavedDialog(false);
    const pending = pendingActionRef.current;
    pendingActionRef.current = null;
    pending?.();
  };

  const handleDiscardAndLeave = () => {
    setShowUnsavedDialog(false);
    const pending = pendingActionRef.current;
    pendingActionRef.current = null;
    pending?.();
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    if (status === 'authenticated') {
      void fetchJournals();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchJournals, status]);

  useEffect(() => {
    if (status !== 'authenticated' || !activeJournalId) return;
    resetToEmpty();
    void fetchEntries();
    void fetchTemplates();
  }, [activeJournalId, fetchEntries, fetchTemplates, resetToEmpty, status]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
    };
    globalThis.addEventListener('beforeunload', onBeforeUnload);
    return () => globalThis.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    if (!activeJournalId || selectedDate || !todayEntryExists) return;
    void loadEntry(today);
  }, [activeJournalId, loadEntry, selectedDate, today, todayEntryExists]);

  useEffect(() => {
    const media = globalThis.matchMedia?.('(min-width: 768px)');
    if (!media) return;
    const update = () => setIsMobile(!media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    if (selectedDate && selectedEntryExists) setMobileSidebarVisible(false);
  }, [isMobile, selectedDate, selectedEntryExists]);

  if (status === 'loading' || status === 'unauthenticated') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="border-border border-t-primary h-8 w-8 animate-spin rounded-full border-4" />
      </div>
    );
  }

  const initialLoading = journals.length === 0 || loadingList || loadingEntry;
  const primaryButtonClass =
    'bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors disabled:opacity-60';
  const actionButtonClass =
    'border-border bg-card hover:bg-accent/70 hover:border-primary/35 flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium shadow-xs transition-colors';

  const mainContent = (
    <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
      {initialLoading ? (
        <div className="border-border bg-card flex items-center justify-between border-b px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="bg-muted h-6 w-48 animate-pulse rounded" />
        </div>
      ) : (
        <DiaryHeader
          selectedDate={selectedDate}
          weatherSummary={selectedWeatherSummary}
          saveState={saveState}
          isDirty={isDirty}
          loadingEntry={loadingEntry}
          creatingEntry={creatingEntry}
          mobileSidebarVisible={mobileSidebarVisible}
          templates={templates}
          diaryTemperatureUnit={diaryTemperatureUnit}
          dateLocale={dateLocale}
          onShowMobileSidebar={() => setMobileSidebarVisible(true)}
          onSave={() => {
            void saveCurrentEntry(selectedDate, content);
          }}
          onApplyTemplate={applyTemplate}
          onOpenTemplateManager={() => setShowTemplateManagerDialog(true)}
        />
      )}

      {!initialLoading && (!selectedDate || !selectedEntryExists) && (
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="border-border bg-card w-full max-w-lg rounded-xl border p-6">
            <h2 className="mb-4 text-lg font-semibold">{t('diary.journal')}</h2>
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => createEntryForDate(today)}
                className={cn(primaryButtonClass, 'w-full')}
                disabled={todayEntryExists || creatingEntry}
              >
                <Plus size={14} />
                {t('diary.createToday')}
              </button>
              <button
                type="button"
                className={actionButtonClass}
                onClick={() => {
                  setCreateDateValue(selectedDate ?? today);
                  setShowCreateDialog(true);
                }}
                disabled={creatingEntry}
              >
                <CalendarDays size={14} />
                {t('diary.chooseDateCreate')}
              </button>
            </div>
          </div>
        </div>
      )}
      {!initialLoading && selectedDate && selectedEntryExists && (
        <>
          {editor && <EditorToolbar editor={editor} blockId={`diary-${selectedDate}`} />}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loadingEntry ? (
              <div className="p-6">
                <div className="bg-muted h-40 animate-pulse rounded-xl" />
              </div>
            ) : (
              <PageEditor
                key={selectedDate || 'empty'}
                content={content}
                editable
                mode="diary"
                onChange={handleContentChange}
                pageId={`diary-${selectedDate}`}
                onEditorReady={setEditor}
              />
            )}
          </div>
        </>
      )}
    </section>
  );

  return (
    <>
      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onSaveAndLeave={handleSaveAndLeave}
        onLeaveWithout={handleDiscardAndLeave}
        onCancel={() => {
          setShowUnsavedDialog(false);
          pendingActionRef.current = null;
        }}
      />

      <DiaryCreateEntryDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        selectedDate={createDateValue}
        onSelectDate={setCreateDateValue}
        monthCursor={monthCursor}
        onPrevMonth={() =>
          setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
        }
        onNextMonth={() =>
          setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
        }
        onSetMonthDate={setMonthCursor}
        entriesByDate={entriesByDate}
        onConfirm={() => {
          if (!createDateValue) return;
          createEntryForDate(createDateValue);
          setShowCreateDialog(false);
        }}
        creatingEntry={creatingEntry}
        dateLocale={dateLocale}
      />

      <DiaryTemplateManagerDialog
        open={showTemplateManagerDialog}
        onOpenChange={setShowTemplateManagerDialog}
        templates={templates}
        loadingTemplates={loadingTemplates}
        onCreate={createTemplate}
        onUpdate={updateTemplate}
        onDelete={deleteTemplate}
      />

      <div className="bg-background relative flex h-full overflow-hidden">
        <Sidebar
          visible={sidebarVisible}
          onShow={() => setSidebarVisible(true)}
          transition={sidebarTransition}
          mobileOverlay={{
            open: mobileSidebarVisible,
            onClose: () => setMobileSidebarVisible(false),
          }}
        >
          <DiarySidebarContent
            journals={journals}
            activeJournalId={activeJournalId}
            activeJournal={activeJournal}
            setActiveJournalId={setActiveJournalId}
            createJournal={createJournal}
            renameJournal={renameJournal}
            effectiveVisible={effectiveVisible}
            isMobile={isMobile}
            setSidebarVisible={setSidebarVisible}
            setMobileSidebarVisible={setMobileSidebarVisible}
            viewMode={viewMode}
            setViewMode={setViewMode}
            monthCursor={monthCursor}
            setMonthCursor={setMonthCursor}
            selectedDate={selectedDate}
            entriesByDate={entriesByDate}
            entries={entries}
            groupedEntries={groupedEntries}
            handleSelectDate={handleSelectDate}
            loadingList={loadingList}
            setDeleteTargetDate={handleDeleteEntry}
            diaryTemperatureUnit={diaryTemperatureUnit}
            dateLocale={dateLocale}
            todayEntryExists={todayEntryExists}
            creatingEntry={creatingEntry}
            onCreateToday={() => {
              if (todayEntryExists) return;
              createEntryForDate(today);
            }}
            onOpenCreateDateDialog={() => {
              setCreateDateValue(selectedDate ?? today);
              setShowCreateDialog(true);
            }}
            onOpenTemplateManager={() => setShowTemplateManagerDialog(true)}
            error={entryError ?? journalError}
          />
        </Sidebar>
        <div className="h-full flex-1">{mainContent}</div>
      </div>
    </>
  );
}
