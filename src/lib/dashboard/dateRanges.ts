export const DASHBOARD_RANGE_OPTIONS = [
  { key: 'today', label: 'Today', days: 1 },
  { key: '7d', label: 'Last 7 Days', days: 7 },
  { key: '30d', label: 'Last 30 Days', days: 30 },
  { key: '3m', label: '3 Months', days: 90 },
  { key: '6m', label: '6 Months', days: 180 },
  { key: '12m', label: '12 Months', days: 365 },
] as const;

export type DashboardRangeKey = (typeof DASHBOARD_RANGE_OPTIONS)[number]['key'];

export interface DashboardRange {
  key: DashboardRangeKey;
  label: string;
  days: number;
  startIso: string;
  endIso: string;
}

export function resolveDashboardRange(input?: string | null): DashboardRange {
  const matched = DASHBOARD_RANGE_OPTIONS.find((option) => option.key === input) ?? DASHBOARD_RANGE_OPTIONS[1];
  const end = new Date();
  const start = new Date(end);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  start.setDate(start.getDate() - (matched.days - 1));

  return {
    key: matched.key,
    label: matched.label,
    days: matched.days,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}
