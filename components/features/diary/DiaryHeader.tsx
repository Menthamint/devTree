'use client';
import { useRef, useState } from 'react';

import { ChevronDown, Edit3, FileText, Menu, Save } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/shared/ui/tooltip';
import { formatDateLong, parseLocalDate } from '@/lib/dateUtils';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

import { decodeTemplateText, formatTemp, getHeaderSubtitle, getWeatherIcon } from './diaryUtils';
import type { DiaryTemplate, WeatherSummary } from './types';

type Props = {
  selectedDate: string | null;
  weatherSummary: WeatherSummary | null;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  isDirty: boolean;
  loadingEntry: boolean;
  creatingEntry: boolean;
  mobileSidebarVisible: boolean;
  templates: DiaryTemplate[];
  diaryTemperatureUnit: 'c' | 'f';
  dateLocale: string;
  onShowMobileSidebar: () => void;
  onSave: () => void;
  onApplyTemplate: (template: DiaryTemplate) => void;
  onOpenTemplateManager: () => void;
};

export function DiaryHeader({
  selectedDate,
  weatherSummary,
  saveState,
  isDirty,
  loadingEntry,
  creatingEntry,
  mobileSidebarVisible,
  templates,
  diaryTemperatureUnit,
  dateLocale,
  onShowMobileSidebar,
  onSave,
  onApplyTemplate,
  onOpenTemplateManager,
}: Readonly<Props>) {
  const { t } = useI18n();
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const templateMenuRef = useRef<HTMLDivElement>(null);

  const headerSubtitle = getHeaderSubtitle(selectedDate, weatherSummary?.locationShort, t);

  return (
    <header data-testid="diary-header" className="border-border bg-card flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="flex">
        {!mobileSidebarVisible && (
          <button
            type="button"
            aria-label={t('sidebar.show')}
            data-ui-sound-event="open"
            className="motion-interactive icon-tilt-hover text-muted-foreground hover:bg-accent hover:text-accent-foreground mr-1 rounded p-1.5 transition-colors md:hidden"
            onClick={onShowMobileSidebar}
          >
            <Menu size={20} />
          </button>
        )}
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            {selectedDate && weatherSummary ? (
              <span className="bg-muted inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium">
                {getWeatherIcon(weatherSummary.weatherCode)}{' '}
                {formatTemp(weatherSummary.tempC, diaryTemperatureUnit)}
              </span>
            ) : null}
            <span>
              {selectedDate
                ? formatDateLong(parseLocalDate(selectedDate), dateLocale)
                : t('nav.diary')}
            </span>
          </h1>
          <p className="text-muted-foreground text-sm">{headerSubtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div ref={templateMenuRef} className="relative">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={t('diary.applyTemplate')}
                disabled={!selectedDate || templates.length === 0}
                onClick={() => setShowTemplateMenu((prev) => !prev)}
                className="border-border bg-background hover:bg-accent disabled:text-muted-foreground inline-flex items-center gap-1 rounded-md border p-2 text-xs disabled:opacity-60"
              >
                <FileText size={14} />
                <ChevronDown size={12} />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">{t('diary.applyTemplate')}</p>
            </TooltipContent>
          </Tooltip>

          {showTemplateMenu && (
            <div
              className="border-border bg-popover absolute right-0 z-50 mt-1 max-h-56 w-64 overflow-y-auto rounded-md border p-1 shadow-md"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className="hover:bg-accent w-full rounded-sm px-2 py-1.5 text-left text-sm"
                  onClick={() => {
                    onApplyTemplate(template);
                    setShowTemplateMenu(false);
                  }}
                >
                  <p className="truncate font-medium">{template.name}</p>
                  <p className="text-muted-foreground line-clamp-2 text-xs">
                    {decodeTemplateText(template.body)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={t('diary.templates')}
              onClick={onOpenTemplateManager}
              className="border-border bg-background hover:bg-accent disabled:text-muted-foreground inline-flex items-center rounded-md border p-2 text-xs disabled:opacity-60"
            >
              <Edit3 size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{t('diary.templates')}</p>
          </TooltipContent>
        </Tooltip>

        <span
          className={cn(
            'hidden text-xs sm:inline',
            saveState === 'saving' && 'text-muted-foreground',
            saveState === 'saved' && 'text-green-600 dark:text-green-400',
            saveState === 'error' && 'text-destructive',
          )}
        >
          {saveState === 'saving' && t('diary.saving')}
          {saveState === 'saved' && t('main.saved')}
          {saveState === 'error' && t('diary.saveFailed')}
          {saveState === 'idle' && (isDirty ? t('diary.unsavedChanges') : t('diary.ready'))}
        </span>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={t('main.save')}
              disabled={!isDirty || !selectedDate || loadingEntry || creatingEntry}
              onClick={onSave}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm',
                isDirty && selectedDate && !loadingEntry && !creatingEntry
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed',
              )}
            >
              <Save size={14} />
              {t('main.save')}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{t('main.save')}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
