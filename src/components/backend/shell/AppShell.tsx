'use client';

import { useState } from 'react';
import AppSide from './AppSide';
import Topbar from './Topbar';
import type { DashboardLeadNotification } from '@/lib/notifications/queries';

interface AppShellProps {
  children: React.ReactNode;
  businessName: string;
  businessFaviconUrl?: string | null;
  userInitials: string;
  userRole?: 'admin' | 'employee';
  isPlatformAdmin?: boolean;
  leadNotifications: DashboardLeadNotification[];
  unreadLeadCount: number;
}

export default function AppShell({
  children,
  businessName,
  businessFaviconUrl = null,
  userInitials,
  userRole = 'employee',
  isPlatformAdmin = false,
  leadNotifications,
  unreadLeadCount,
}: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className={`shell shell--hsg ${sidebarOpen ? '' : 'shell--collapsed'}`}>
      <AppSide
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
        userRole={userRole}
        isPlatformAdmin={isPlatformAdmin}
        businessName={businessName}
        businessFaviconUrl={businessFaviconUrl}
        unreadLeadCount={unreadLeadCount}
      />
      <div className="shell__content">
        <Topbar
          userInitials={userInitials}
          isPlatformAdmin={isPlatformAdmin}
          leadNotifications={leadNotifications}
          unreadLeadCount={unreadLeadCount}
        />
        <main className="shell__main">
          {children}
        </main>
      </div>
    </div>
  );
}
