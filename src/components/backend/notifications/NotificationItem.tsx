'use client';

import Link from 'next/link';
import type { DashboardLeadNotification } from '@/lib/notifications/queries';

interface NotificationItemProps {
  notification: DashboardLeadNotification;
  onNavigate?: () => void;
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export default function NotificationItem({ notification, onNavigate }: NotificationItemProps) {
  return (
    <Link href={notification.href} className="topbar__notif-item" onClick={onNavigate}>
      <span className="topbar__notif-item-dot" aria-hidden="true" />
      <div className="topbar__notif-item-body">
        <div className="topbar__notif-item-head">
          <strong>{notification.title}</strong>
          <span>{formatRelativeTime(notification.submittedAt)}</span>
        </div>
        <p>{notification.preview}</p>
        <small>{notification.sourceLabel}</small>
      </div>
    </Link>
  );
}
