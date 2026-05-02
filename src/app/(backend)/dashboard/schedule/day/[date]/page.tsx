import { notFound } from 'next/navigation';
import ModuleShell from '@/components/backend/shell/ModuleShell';
import ScheduleDayView from '@/components/backend/ScheduleDayView';
import {
  getDashboardJobsForSelection,
  getDashboardScheduleItemsForDay,
  getDashboardScheduleJobsForDay,
  getDashboardTeamMembersForJobAssignment,
} from '@/lib/operations/queries';

interface Props {
  params: Promise<{ date: string }>;
  searchParams?: Promise<{ at?: string; item?: string }>;
}

function parseDayParam(dayParam: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayParam)) return null;
  const [year, month, day] = dayParam.split('-').map(Number);
  const parsed = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toYyyyMmDd(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimeRange(startsAt: string, endsAt: string | null) {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return startsAt;
  const startLabel = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (!endsAt) return startLabel;
  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime())) return startLabel;
  return `${startLabel} - ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

function formatPersonName(person: { first_name: string | null; last_name: string | null } | null) {
  if (!person) return null;
  return [person.first_name, person.last_name].filter(Boolean).join(' ').trim() || null;
}

function pad(value: number) {
  return `${value}`.padStart(2, '0');
}

function toSlotStamp(date: Date, hour: number) {
  return `${toYyyyMmDd(date)}T${pad(hour)}:00`;
}

function formatSlotLabel(hour: number) {
  const date = new Date(2000, 0, 1, hour, 0, 0, 0);
  return date.toLocaleTimeString([], { hour: 'numeric' });
}

export default async function ScheduleDayPage({ params, searchParams }: Props) {
  const { date } = await params;
  const query = (searchParams ? await searchParams : {}) ?? {};
  const dayDate = parseDayParam(date);
  if (!dayDate) notFound();

  const [jobs, items, teamMembers, jobOptions] = await Promise.all([
    getDashboardScheduleJobsForDay(date),
    getDashboardScheduleItemsForDay(date),
    getDashboardTeamMembersForJobAssignment(),
    getDashboardJobsForSelection(),
  ]);

  const entries = [
    ...jobs
      .filter((job) => Boolean(job.id))
      .map((job) => ({
        id: job.id as string,
        type: 'Job' as const,
        title: job.title ?? '-',
        startsAt: job.scheduled_start ?? '',
        time: formatTimeRange(job.scheduled_start ?? '', job.scheduled_end),
        href: `/dashboard/jobs/${job.id}`,
        meta: [job.assigned_to_name, job.customer_name, job.service_name].filter(Boolean).join(' | '),
      })),
    ...items
      .map((item) => ({
        id: item.id,
        type: 'Custom' as const,
        title: item.title,
        startsAt: item.starts_at,
        time: formatTimeRange(item.starts_at, item.ends_at),
        href: `/dashboard/schedule/day/${date}?item=${item.id}`,
        meta:
          [
            formatPersonName(item.assigned_team_member ?? item.assigned_profile),
            item.related_job?.title ? `Linked: ${item.related_job.title}` : null,
            item.location || null,
          ]
            .filter(Boolean)
            .join(' | '),
      })),
  ].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const defaultSlotStamp = `${date}T09:00`;
  const selectedSlotStamp =
    query.at && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(query.at) ? query.at : defaultSlotStamp;
  const selectedItem = query.item ? items.find((item) => item.id === query.item) ?? null : null;
  const slots = Array.from({ length: 15 }, (_, index) => 6 + index).map((hour) => ({
    hour,
    label: formatSlotLabel(hour),
    at: toSlotStamp(dayDate, hour),
    entries: entries.filter((entry) => {
      const date = new Date(entry.startsAt);
      return !Number.isNaN(date.getTime()) && date.getHours() === hour;
    }),
  }));

  return (
    <ModuleShell
      title="Schedule"
      description="Review everything scheduled for this day and add new items from here."
    >
      <ScheduleDayView
        day={date}
        dayLabel={formatDayLabel(dayDate)}
        month={date.slice(0, 7)}
        totalCount={entries.length}
        slots={slots}
        teamMembers={teamMembers.map((member) => ({
          team_member_id: member.team_member_id,
          first_name: member.first_name,
          last_name: member.last_name,
          title: member.title,
        }))}
        jobs={jobOptions.map((job) => ({
          id: job.id,
          title: job.title,
          scheduled_start: job.scheduled_start,
          status: job.status,
        }))}
        items={items.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description ?? null,
          starts_at: item.starts_at,
          ends_at: item.ends_at,
          location: item.location ?? null,
          assigned_team_member_id:
            (item as { assigned_team_member_id?: string | null }).assigned_team_member_id ?? null,
          related_job_id: item.related_job_id ?? null,
        }))}
        initialAt={selectedItem?.starts_at.slice(0, 16) ?? selectedSlotStamp}
        initialItemId={selectedItem?.id ?? null}
      />
    </ModuleShell>
  );
}
