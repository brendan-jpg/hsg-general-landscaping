import Link from 'next/link';
import BackendTabs from '@/components/backend/BackendTabs';
import ModuleShell from '@/components/backend/shell/ModuleShell';
import DataTable from '@/components/backend/DataTable';
import Button from '@/components/shared/Button';
import StatusBadge from '@/components/shared/StatusBadge';
import { getDashboardEstimates } from '@/lib/operations/queries';
import type { Tables } from '@/lib/types/database';

type EstimateStatus = Tables<'estimates'>['status'];

const tabs: Array<{ label: string; value: EstimateStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Sent', value: 'sent' },
  { label: 'Approved', value: 'approved' },
  { label: 'Declined', value: 'declined' },
];

interface EstimatesPageProps {
  searchParams?: Promise<{ status?: string }>;
}

function formatContactName(contact: { first_name: string | null; last_name: string | null } | null) {
  if (!contact) return '-';
  return [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || '-';
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export default async function EstimatesPage({ searchParams }: EstimatesPageProps) {
  const params = searchParams ? await searchParams : {};
  const statusParam = (params.status ?? 'all') as EstimateStatus | 'all';
  const activeStatus = tabs.some((tab) => tab.value === statusParam) ? statusParam : 'all';
  const estimates = await getDashboardEstimates(activeStatus);

  return (
    <ModuleShell
      title="Estimates"
      description="Create and manage estimates"
      toolbar={
        <BackendTabs
          ariaLabel="Estimate status filters"
          activeValue={activeStatus}
          items={tabs.map((tab) => ({
            label: tab.label,
            value: tab.value,
            href: tab.value === 'all' ? '/dashboard/estimates' : `/dashboard/estimates?status=${tab.value}`,
          }))}
        />
      }
      actions={
        <Button as="link" href="/dashboard/estimates/new">
          New Estimate
        </Button>
      }
    >
      <DataTable
        columns={['Estimate #', 'Total', 'Customer', 'Status', 'Valid Until']}
        rows={estimates.map((estimate) => ({
          'Estimate #': <Link href={`/dashboard/estimates/${estimate.id}`}>{estimate.estimate_number}</Link>,
          Total: formatCurrency(estimate.total ?? 0),
          Customer: formatContactName(estimate.contacts),
          Status: <StatusBadge status={estimate.status} />,
          'Valid Until': estimate.valid_until ? new Date(estimate.valid_until).toLocaleDateString() : '-',
        }))}
        rowHrefs={estimates.map((estimate) => `/dashboard/estimates/${estimate.id}`)}
        emptyMessage="No estimates yet"
      />
    </ModuleShell>
  );
}
