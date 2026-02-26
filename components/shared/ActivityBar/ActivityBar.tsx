'use client';

import React from 'react';

import { usePathname, useRouter } from 'next/navigation';

import { motion, useReducedMotion } from 'framer-motion';
import { BarChart2, BookHeart, BookOpen, Settings } from 'lucide-react';

import { useSettingsDialog } from '@/components/features/SettingsDialog/useSettingsDialog';
import { TooltipProvider } from '@/components/shared/ui/tooltip';
import { getLastNotebookPageId } from '@/lib/notebookPageMemory';
import { useStatsStore } from '@/lib/statsStore';

import { ActivityBarItem } from './ActivityBarItem';

const TOP_ITEMS = [
  {
    id: 'notebook',
    label: 'Notebook',
    icon: <BookOpen size={20} />,
    href: '/notebook',
  },
  {
    id: 'statistics',
    label: 'Statistics',
    icon: <BarChart2 size={20} />,
    href: '/statistics',
  },
  {
    id: 'diary',
    label: 'Diary (coming soon)',
    icon: <BookHeart size={20} />,
    href: null,
    disabled: true,
  },
] as const;

export function ActivityBar() {
  const pathname = usePathname();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const { openSettings } = useSettingsDialog();
  const { enabled: statisticsEnabled } = useStatsStore();

  /** Determine active section from current pathname */
  const activeId = (() => {
    if (pathname === '/' || pathname === '' || pathname.startsWith('/notebook')) return 'notebook';
    if (pathname.startsWith('/statistics')) return 'statistics';
    return 'notebook';
  })();

  const visibleItems = TOP_ITEMS.filter(
    (item) => !(item.id === 'statistics' && !statisticsEnabled),
  );

  const navigateToSection = (item: (typeof TOP_ITEMS)[number]) => {
    if (!item.href) return;

    if (item.id === 'notebook') {
      const lastPageId = getLastNotebookPageId();
      if (lastPageId) {
        router.push(`/notebook?page=${encodeURIComponent(lastPageId)}`);
        return;
      }
    }

    router.push(item.href);
  };

  return (
    <TooltipProvider>
      <motion.nav
        key={`activity-bar-${activeId}`}
        aria-label="Application sections"
        className="alive-surface bg-background flex h-full w-12 shrink-0 flex-col items-center gap-1 border-r py-2"
        initial={reducedMotion ? false : { x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={reducedMotion ? { duration: 0.01 } : { type: 'spring', stiffness: 360, damping: 30, mass: 0.9 }}
      >
        {/* Top section items */}
        <div className="flex flex-1 flex-col gap-1">
          {visibleItems.map((item) => (
            <ActivityBarItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={activeId === item.id}
              disabled={'disabled' in item ? item.disabled : false}
              onClick={
                !('disabled' in item) || !item.disabled
                  ? () => {
                      navigateToSection(item);
                    }
                  : undefined
              }
            />
          ))}
        </div>

        {/* Pinned bottom: Settings */}
        <ActivityBarItem icon={<Settings size={20} />} label="Settings" onClick={openSettings} />
      </motion.nav>
    </TooltipProvider>
  );
}
