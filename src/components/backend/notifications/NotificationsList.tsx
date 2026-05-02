'use client';

import NotificationItem from './NotificationItem';
import type { DashboardLeadNotification } from '@/lib/notifications/queries';

interface NotificationsListProps {
  notifications: DashboardLeadNotification[];
  onNavigate?: () => void;
}

export default function NotificationsList({ notifications, onNavigate }: NotificationsListProps) {
  if (notifications.length === 0) {
    return (
      <div className="topbar__notif-empty">
        <p className="topbar__notif-empty-title">All caught up.</p>
        <p className="topbar__notif-empty-copy">New website leads will show up here as soon as they come in.</p>
      </div>
    );
  }

  return (
    <div className="topbar__notif-list" role="list">
      {notifications.map((notification) => (
        <NotificationItem key={notification.id} notification={notification} onNavigate={onNavigate} />
      ))}
    </div>
  );
}
