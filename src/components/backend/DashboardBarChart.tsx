interface DashboardBarChartPoint {
  label: string;
  value: number;
}

interface DashboardBarChartProps {
  title: string;
  subtitle?: string;
  points: DashboardBarChartPoint[];
  formatValue?: (value: number) => string;
}

export default function DashboardBarChart({
  title,
  subtitle,
  points,
  formatValue = (value) => new Intl.NumberFormat('en-US').format(value),
}: DashboardBarChartProps) {
  const maxValue = Math.max(...points.map((point) => point.value), 0);
  const highlightIndex = maxValue > 0 ? points.findIndex((point) => point.value === maxValue) : Math.max(points.length - 1, 0);
  const axisValues = maxValue > 0 ? buildAxisValues(maxValue) : [];

  return (
    <section className="dashboard-chart">
      <header className="dashboard-chart__header">
        <div className="dashboard-chart__copy">
          <h2 className="dashboard-chart__title">{title}</h2>
          {subtitle ? <p className="dashboard-chart__subtitle">{subtitle}</p> : null}
        </div>
      </header>

      <div className="dashboard-chart__body">
        <div className="dashboard-chart__bars" role="img" aria-label={title}>
          {points.map((point, index) => {
            const height = maxValue > 0 ? Math.max(16, (point.value / maxValue) * 100) : 16;
            const isActive = index === highlightIndex;

            return (
              <div key={`${point.label}-${index}`} className="dashboard-chart__column">
                <div className="dashboard-chart__bar-wrap">
                  <div
                    className={`dashboard-chart__bar${isActive ? ' dashboard-chart__bar--active' : ''}`}
                    style={{ height: `${height}%` }}
                    title={`${point.label}: ${formatValue(point.value)}`}
                  />
                </div>
                <span className="dashboard-chart__label">{point.label}</span>
              </div>
            );
          })}
        </div>

        {axisValues.length > 0 ? (
          <div className="dashboard-chart__axis" aria-hidden="true">
            {axisValues.map((value) => (
              <span key={value}>{formatValue(value)}</span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function buildAxisValues(maxValue: number) {
  const step = maxValue / 4;
  return [maxValue, maxValue - step, maxValue - step * 2, maxValue - step * 3, 0].map((value) =>
    Math.max(0, Math.round(value)),
  );
}
