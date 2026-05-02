import Link from 'next/link';
import ModuleShell from '@/components/backend/shell/ModuleShell';
import ScheduleMonthBoard from '@/components/backend/ScheduleMonthBoard';
import { getDashboardScheduleItems, getDashboardScheduleJobs } from '@/lib/operations/queries';

interface SchedulePageProps {
  searchParams?: Promise<{ month?: string }>;
}

function getMonthStartFromSearch(monthParam?: string) {
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [year, month] = monthParam.split('-').map(Number);
    const parsed = new Date(year, (month || 1) - 1, 1);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function toYyyyMmDd(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toYyyyMm(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function buildScheduleHref(params: { type?: string; view?: string; week?: string; month?: string }) {
  const search = new URLSearchParams();
  if (params.month) search.set('month', params.month);
  const query = search.toString();
  return query ? `/dashboard/schedule?${query}` : '/dashboard/schedule';
}

export default async function SchedulePage({ searchParams }: SchedulePageProps) {
  const params = searchParams ? await searchParams : {};
  const monthStartDate = getMonthStartFromSearch(params.month);
  const monthStart = toYyyyMmDd(monthStartDate);
  const prevMonth = toYyyyMm(addMonths(monthStartDate, -1));
  const nextMonth = toYyyyMm(addMonths(monthStartDate, 1));

  const [jobs, items] = await Promise.all([getDashboardScheduleJobs(), getDashboardScheduleItems()]);

  const rows = [
    ...jobs.map((job) => ({
      sourceType: 'job' as const,
      sortAt: job.scheduled_start ?? '',
      href: job.id ? `/dashboard/jobs/${job.id}` : undefined,
    })),
    ...items.map((item) => ({
      sourceType: 'custom' as const,
      sortAt: item.starts_at,
      href: `/dashboard/schedule/${item.id}`,
    })),
  ]
    .sort((a, b) => {
      if (!a.sortAt && !b.sortAt) return 0;
      if (!a.sortAt) return 1;
      if (!b.sortAt) return -1;
      return new Date(a.sortAt).getTime() - new Date(b.sortAt).getTime();
    });

  const monthEntries = rows
    .map((row) => {
      if (row.sourceType === 'job') {
        const job = jobs.find((candidate) => candidate.id && `/dashboard/jobs/${candidate.id}` === row.href);
        if (!job?.id || !job.scheduled_start) return null;
        return {
          id: job.id,
          sourceType: 'job' as const,
          title: job.title ?? '-',
          assignedLabel: job.assigned_to_name ?? 'Unassigned',
          statusLabel: job.status ?? '-',
          startsAt: job.scheduled_start,
          endsAt: job.scheduled_end,
          href: `/dashboard/jobs/${job.id}`,
        };
      }

      const item = items.find((candidate) => `/dashboard/schedule/${candidate.id}` === row.href);
      if (!item) return null;
      return {
        id: item.id,
        sourceType: 'custom' as const,
        title: item.title,
        assignedLabel:
          [item.assigned_team_member?.first_name, item.assigned_team_member?.last_name]
            .filter(Boolean)
            .join(' ')
            .trim() ||
          [item.assigned_profile?.first_name, item.assigned_profile?.last_name]
            .filter(Boolean)
            .join(' ')
            .trim() ||
          'Unassigned',
        statusLabel: item.related_job ? `Linked: ${item.related_job.title}` : 'Custom item',
        startsAt: item.starts_at,
        endsAt: item.ends_at,
        href: `/dashboard/schedule/${item.id}`,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  return (
    <ModuleShell
      title="Schedule"
      description="See scheduled jobs and custom schedule items in one place"
    >
      <div className="schedule-week__toolbar">
        <Link href={buildScheduleHref({ month: prevMonth })} className="btn schedule-week__nav">
          <span aria-hidden="true">&larr;</span>
          <span>Previous Month</span>
        </Link>
        <span className="schedule-week__range">
          {monthStartDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
        </span>
        <Link href={buildScheduleHref({ month: nextMonth })} className="btn schedule-week__nav">
          <span>Next Month</span>
          <span aria-hidden="true">&rarr;</span>
        </Link>
      </div>
      <ScheduleMonthBoard
        monthStart={monthStart}
        entries={monthEntries}
        dayHrefBase="/dashboard/schedule/day"
      />
    </ModuleShell>
  );
}
