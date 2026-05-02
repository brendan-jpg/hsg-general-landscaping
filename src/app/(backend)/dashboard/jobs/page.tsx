import Link from 'next/link';
import BackendTabs from '@/components/backend/BackendTabs';
import ModuleShell from '@/components/backend/shell/ModuleShell';
import DataTable from '@/components/backend/DataTable';
import Button from '@/components/shared/Button';
import StatusBadge from '@/components/shared/StatusBadge';
import { getDashboardJobs } from '@/lib/operations/queries';
import { formatDateTime } from '@/lib/utils';
import type { Tables } from '@/lib/types/database';

type JobStatus = Tables<'jobs'>['status'];

const tabs: Array<{ label: string; value: JobStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Scheduled', value: 'scheduled' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
];

interface JobsPageProps {
  searchParams?: Promise<{ status?: string }>;
}

function formatContactName(contact: { first_name: string | null; last_name: string | null } | null) {
  if (!contact) return '-';
  return [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || '-';
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const params = searchParams ? await searchParams : {};
  const statusParam = (params.status ?? 'all') as JobStatus | 'all';
  const activeStatus = tabs.some((tab) => tab.value === statusParam) ? statusParam : 'all';
  const jobs = await getDashboardJobs(activeStatus);

  return (
    <ModuleShell
      title="Jobs"
      description="Manage and track all jobs"
      toolbar={
        <BackendTabs
          ariaLabel="Job status filters"
          activeValue={activeStatus}
          items={tabs.map((tab) => ({
            label: tab.label,
            value: tab.value,
            href: tab.value === 'all' ? '/dashboard/jobs' : `/dashboard/jobs?status=${tab.value}`,
          }))}
        />
      }
      actions={
        <Button as="link" href="/dashboard/jobs/new">
          New Job
        </Button>
      }
    >
      <DataTable
        columns={['Title', 'Customer', 'Status', 'Scheduled', 'Priority']}
        rows={jobs.map((job) => ({
          Title: <Link href={`/dashboard/jobs/${job.id}`}>{job.title}</Link>,
          Customer: formatContactName(job.contacts),
          Status: <StatusBadge status={job.status} />,
          Scheduled: job.scheduled_start ? formatDateTime(job.scheduled_start) : '-',
          Priority: job.priority,
        }))}
        rowHrefs={jobs.map((job) => `/dashboard/jobs/${job.id}`)}
        emptyMessage="No jobs yet"
      />
    </ModuleShell>
  );
}
