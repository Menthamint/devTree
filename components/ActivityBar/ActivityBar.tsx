'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { BookOpen, BarChart2, BookHeart, Settings } from 'lucide-react';

import { ActivityBarItem } from './ActivityBarItem';
import { useSettingsDialog } from '@/components/SettingsDialog/useSettingsDialog';

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
  const { openSettings } = useSettingsDialog();

  /** Determine active section from current pathname */
  const activeId = (() => {
    if (pathname === '/' || pathname === '' || pathname.startsWith('/notebook')) return 'notebook';
    if (pathname.startsWith('/statistics')) return 'statistics';
    return 'notebook';
  })();

  return (
    <nav
      aria-label="Application sections"
      className="flex h-full w-12 shrink-0 flex-col items-center border-r bg-background py-2 gap-1"
    >
      {/* Top section items */}
      <div className="flex flex-col gap-1 flex-1">
        {TOP_ITEMS.map((item) => (
          <ActivityBarItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={activeId === item.id}
            disabled={'disabled' in item ? item.disabled : false}
            onClick={
              !('disabled' in item) || !item.disabled
                ? () => {
                    if (item.href) router.push(item.href);
                  }
                : undefined
            }
          />
        ))}
      </div>

      {/* Pinned bottom: Settings */}
      <ActivityBarItem
        icon={<Settings size={20} />}
        label="Settings"
        onClick={openSettings}
      />
    </nav>
  );
}
