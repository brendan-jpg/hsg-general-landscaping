interface StatCardProps {
  label: string;
  value: number | string;
  format?: 'number' | 'currency';
  trend?: { value: number; direction: 'up' | 'down' };
  icon?: React.ReactNode;
}

export default function StatCard({ label, value, format, trend, icon }: StatCardProps) {
  const formatted = format === 'currency'
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value))
    : value;

  return (
    <div className="stat-card">
      <div className="stat-card__head">
        {icon ? <span className="stat-card__icon" aria-hidden="true">{icon}</span> : null}
        <span className="stat-card__label">{label}</span>
      </div>
      <span className="stat-card__value">{formatted}</span>
      {trend && (
        <span className={`stat-card__trend stat-card__trend--${trend.direction}`}>
          {trend.direction === 'up' ? '↑' : '↓'} {trend.value}%
        </span>
      )}
    </div>
  );
}
