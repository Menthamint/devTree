'use client';

import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ActivityBarItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  /** If provided, renders as an anchor tag navigating to this href */
  href?: string;
  className?: string;
}

export function ActivityBarItem({
  icon,
  label,
  active = false,
  disabled = false,
  onClick,
  className,
}: ActivityBarItemProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={disabled ? undefined : onClick}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex h-11 w-11 items-center justify-center rounded-lg transition-colors',
              'text-muted-foreground outline-none',
              'hover:bg-accent hover:text-accent-foreground',
              'focus-visible:ring-2 focus-visible:ring-ring',
              active && 'bg-accent text-accent-foreground',
              disabled && 'pointer-events-none opacity-40',
              className,
            )}
          >
            {/* Active indicator strip */}
            {active && (
              <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full bg-primary" />
            )}
            <span className="h-5 w-5 flex items-center justify-center">{icon}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
