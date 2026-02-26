'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/shared/ui/tooltip';
import { formatDateMedium, formatRelativeTime } from '@/lib/dateUtils';
import { useI18n } from '@/lib/i18n';

type PageMetaProps = Readonly<{
  createdAt?: string;
  updatedAt?: string;
}>;

/**
 * PageMeta — a single compact line showing when the page was created and last
 * edited, rendered just below the tag bar.
 *
 * Each timestamp is shown as relative text ("3 days ago") with a tooltip that
 * reveals the full medium date ("Feb 15, 2025") on hover.
 *
 * Returns null when neither timestamp is available (e.g. during optimistic
 * creation before the server response arrives).
 */
export function PageMeta({ createdAt, updatedAt }: PageMetaProps) {
  const { t } = useI18n();

  if (!createdAt && !updatedAt) return null;

  return (
    <div className="text-muted-foreground/70 flex flex-wrap items-center gap-1.5 text-xs">
      {createdAt && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-default">
              {t('main.createdAt', { date: formatRelativeTime(createdAt) })}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{formatDateMedium(new Date(createdAt))}</p>
          </TooltipContent>
        </Tooltip>
      )}

      {createdAt && updatedAt && <span aria-hidden>·</span>}

      {updatedAt && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-default">
              {t('main.updatedAt', { date: formatRelativeTime(updatedAt) })}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>{formatDateMedium(new Date(updatedAt))}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
