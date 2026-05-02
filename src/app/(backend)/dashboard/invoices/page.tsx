import Link from 'next/link';
import BackendTabs from '@/components/backend/BackendTabs';
import ModuleShell from '@/components/backend/shell/ModuleShell';
import DataTable from '@/components/backend/DataTable';
import Button from '@/components/shared/Button';
import StatusBadge from '@/components/shared/StatusBadge';
import { getDashboardInvoices } from '@/lib/operations/queries';
import type { Tables } from '@/lib/types/database';

type InvoiceStatus = Tables<'invoices'>['status'];

const tabs: Array<{ label: string; value: InvoiceStatus | 'all' }> = [
  { label: 'All', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Sent', value: 'sent' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Paid', value: 'paid' },
];

interface InvoicesPageProps {
  searchParams?: Promise<{ status?: string }>;
}

function formatContactName(contact: { first_name: string | null; last_name: string | null } | null) {
  if (!contact) return '-';
  return [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || '-';
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const params = searchParams ? await searchParams : {};
  const statusParam = (params.status ?? 'all') as InvoiceStatus | 'all';
  const activeStatus = tabs.some((tab) => tab.value === statusParam) ? statusParam : 'all';
  const invoices = await getDashboardInvoices(activeStatus);

  return (
    <ModuleShell
      title="Invoices"
      description="Track payments and outstanding balances"
      toolbar={
        <BackendTabs
          ariaLabel="Invoice status filters"
          activeValue={activeStatus}
          items={tabs.map((tab) => ({
            label: tab.label,
            value: tab.value,
            href: tab.value === 'all' ? '/dashboard/invoices' : `/dashboard/invoices?status=${tab.value}`,
          }))}
        />
      }
      actions={
        <Button as="link" href="/dashboard/invoices/new">
          New Invoice
        </Button>
      }
    >
      <DataTable
        columns={['Invoice #', 'Customer', 'Total', 'Paid', 'Status', 'Due Date']}
        rows={invoices.map((invoice) => ({
          'Invoice #': <Link href={`/dashboard/invoices/${invoice.id}`}>{invoice.invoice_number}</Link>,
          Customer: formatContactName(invoice.contacts),
          Total: formatCurrency(invoice.total ?? 0),
          Paid: formatCurrency(invoice.amount_paid ?? 0),
          Status: <StatusBadge status={invoice.status} />,
          'Due Date': invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '-',
        }))}
        rowHrefs={invoices.map((invoice) => `/dashboard/invoices/${invoice.id}`)}
        emptyMessage="No invoices yet"
      />
    </ModuleShell>
  );
}
