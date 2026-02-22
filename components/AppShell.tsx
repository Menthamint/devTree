'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { ActivityBar } from '@/components/ActivityBar/ActivityBar';
import { SettingsDialog } from '@/components/SettingsDialog/SettingsDialog';
import { useUIStore } from '@/lib/uiStore';

/** Routes where the ActivityBar (main nav) should NOT appear. */
const PUBLIC_ROUTES = ['/login', '/register', '/forgot-password'];

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + '/'))) return true;
  if (pathname.startsWith('/p/')) return true; // Public shared page view
  return false;
}

/**
 * AppShell wraps all pages with the ActivityBar on the left for authenticated routes.
 * Public routes (login, register, shared pages) render children without the ActivityBar.
 *
 * The SettingsDialog is rendered here (not inside MainContent) so it is available
 * on every authenticated route, including the Statistics page.
 */
export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const { settingsDialogOpen, openSettings, closeSettings } = useUIStore();

  if (isPublicRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <ActivityBar />
      <div className="flex-1 overflow-hidden">{children}</div>
      {/* Global SettingsDialog — available on all authenticated routes */}
      <SettingsDialog
        open={settingsDialogOpen}
        onOpenChange={(v) => (v ? openSettings() : closeSettings())}
      />
    </div>
  );
}

