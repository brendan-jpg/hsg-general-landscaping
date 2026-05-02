'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { markAllLeadNotificationsReadAction } from '@/lib/actions';
import NotificationsList from './NotificationsList';
import type { DashboardLeadNotification } from '@/lib/notifications/queries';

interface NotificationBellProps {
  initialNotifications: DashboardLeadNotification[];
  initialUnreadCount: number;
}

export default function NotificationBell({
  initialNotifications,
  initialUnreadCount,
}: NotificationBellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const bellRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [isPending, startTransition] = useTransition();
  const isLeadListOpen = pathname === '/dashboard/leads' || pathname.startsWith('/dashboard/leads?');
  const visibleUnreadCount = isLeadListOpen ? 0 : unreadCount;
  const visibleNotifications = isLeadListOpen ? [] : notifications;

  useEffect(() => {
    setNotifications(initialNotifications);
    setUnreadCount(initialUnreadCount);
  }, [initialNotifications, initialUnreadCount]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  function handleMarkAllRead() {
    if (isPending || visibleUnreadCount === 0) return;

    startTransition(async () => {
      await markAllLeadNotificationsReadAction();
      setNotifications([]);
      setUnreadCount(0);
      setIsOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="topbar__notifications" ref={bellRef}>
      <button
        type="button"
        className={`topbar__icon-link topbar__notif-btn ${isOpen ? 'topbar__notif-btn--open' : ''}`}
        aria-label={visibleUnreadCount > 0 ? `${visibleUnreadCount} unread lead notifications` : 'Lead notifications'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <BellIcon />
        {visibleUnreadCount > 0 ? <span className="topbar__notif-badge" aria-hidden="true">{visibleUnreadCount > 9 ? '9+' : visibleUnreadCount}</span> : null}
      </button>

      {isOpen ? (
        <div className="topbar__notif-dropdown">
          <div className="topbar__notif-header">
            <div>
              <p className="topbar__notif-eyebrow">Inbox</p>
              <h3>Lead notifications</h3>
            </div>
            <button
              type="button"
              className="topbar__notif-action"
              onClick={handleMarkAllRead}
              disabled={isPending || visibleUnreadCount === 0}
            >
              {isPending ? 'Saving...' : 'Mark all read'}
            </button>
          </div>

          <NotificationsList
            notifications={visibleNotifications}
            onNavigate={() => {
              setIsOpen(false);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}
