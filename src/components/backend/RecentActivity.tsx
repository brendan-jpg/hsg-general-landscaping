interface RecentActivityItem {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  tone?: 'success' | 'info' | 'neutral' | 'danger';
}

interface RecentActivityProps {
  activities: RecentActivityItem[];
  actionLabel?: string;
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 'Unknown';

  const diffMs = Date.now() - timestamp;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < hour) return `${Math.max(1, Math.round(diffMs / minute))}m ago`;
  if (diffMs < day) return `${Math.round(diffMs / hour)}h ago`;
  return `${Math.round(diffMs / day)}d ago`;
}

export default function RecentActivity({ activities, actionLabel }: RecentActivityProps) {
  const hasItems = activities.length > 0;

  return (
    <div className="recent-activity">
      <div className="recent-activity__header">
        <h3 className="recent-activity__title">Recent Activity</h3>
        {actionLabel ? (
          <button type="button" className="recent-activity__filter">
            {actionLabel}
          </button>
        ) : null}
      </div>
      <ul className="recent-activity__list">
        {!hasItems && <li className="recent-activity__empty">No activity yet.</li>}
        {activities.map((activity) => (
          <li key={activity.id} className="recent-activity__item">
            <span className={`recent-activity__icon recent-activity__icon--${activity.tone ?? 'neutral'}`} aria-hidden="true">
              {renderActivityGlyph(activity.tone ?? 'neutral')}
            </span>
            <div className="recent-activity__content">
              <span className="recent-activity__action">{activity.title}</span>
              {activity.description ? <span className="recent-activity__description">{activity.description}</span> : null}
              <span className="recent-activity__time">{formatRelativeTime(activity.createdAt)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function renderActivityGlyph(tone: NonNullable<RecentActivityItem['tone']>) {
  if (tone === 'success') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m7 12 3 3 7-7" />
      </svg>
    );
  }

  if (tone === 'danger') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 8v5" />
        <path d="M12 16h.01" />
      </svg>
    );
  }

  if (tone === 'info') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h16v12H4z" />
        <path d="m4 8 8 5 8-5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3h8" />
      <path d="M9 3v3" />
      <path d="M15 3v3" />
      <rect x="4" y="6" width="16" height="14" rx="2" />
      <path d="M8 11h8" />
      <path d="M8 15h5" />
    </svg>
  );
}
