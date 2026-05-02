interface StatusBadgeProps {
  status: string;
}

const statusColors: Record<string, string> = {
  // Jobs
  inquiry: 'neutral',
  quoted: 'info',
  scheduled: 'info',
  in_progress: 'warning',
  completed: 'success',
  cancelled: 'danger',
  canceled: 'danger',

  // Estimates
  draft: 'neutral',
  sent: 'info',
  viewed: 'info',
  approved: 'success',
  declined: 'danger',
  expired: 'neutral',

  // Invoices
  paid: 'success',
  overdue: 'danger',
  void: 'neutral',

  // Blog
  published: 'success',

  // Contacts
  lead: 'warning',
  prospect: 'info',
  customer: 'success',
  inactive: 'neutral',
  attempted: 'info',
  contacted: 'success',
  unqualified: 'neutral',
  lost: 'danger',

  // Form submissions
  new: 'warning',
  read: 'info',
  responded: 'success',
  spam: 'danger',
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const color = statusColors[status] || 'neutral';
  const label = status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

  return (
    <span className={`status-badge status-badge--${color} status-badge--status-${status.replace(/_/g, '-')}`}>
      {label}
    </span>
  );
}
