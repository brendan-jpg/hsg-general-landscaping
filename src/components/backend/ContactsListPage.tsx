import Link from 'next/link';
import BackendTabs from '@/components/backend/BackendTabs';
import ModuleShell from '@/components/backend/shell/ModuleShell';
import DataTable from '@/components/backend/DataTable';
import Button from '@/components/shared/Button';
import StatusBadge from '@/components/shared/StatusBadge';
import { deleteContactsBulk } from '@/lib/actions';
import { getContactDetailPath } from '@/lib/contacts/routing';
import { getDashboardContacts } from '@/lib/contacts/queries';
import type { Tables } from '@/lib/types/database';
import { formatPhone } from '@/lib/utils';

type ContactStatus = Tables<'contacts'>['status'];

interface ContactsListPageProps {
  title: string;
  description: string;
  status: ContactStatus;
  createLabel: string;
  leadStage?: string;
}

const LEAD_STAGE_TABS = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'attempted', label: 'Attempted' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'unqualified', label: 'Unqualified' },
  { value: 'lost', label: 'Lost' },
  { value: 'spam', label: 'Spam' },
] as const;

function formatName(firstName: string | null, lastName: string | null) {
  const full = [firstName, lastName].filter(Boolean).join(' ').trim();
  return full || 'Unnamed Contact';
}

function formatQuality(value: string | null) {
  const normalized = (value ?? '').trim();
  return normalized || 'new';
}

function normalizeLeadStage(value: string | null | undefined) {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) return 'new';
  if (normalized === 'qualified' || normalized === 'hot') return 'contacted';
  if (normalized === 'nurture') return 'attempted';
  if (['new', 'attempted', 'contacted', 'unqualified', 'lost', 'spam'].includes(normalized)) {
    return normalized;
  }
  return 'new';
}

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString();
}

function formatTime(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default async function ContactsListPage({
  title,
  description,
  status,
  createLabel,
  leadStage,
}: ContactsListPageProps) {
  const contacts = await getDashboardContacts(status);
  const isLeadList = status === 'lead';
  const activeLeadStage =
    isLeadList && LEAD_STAGE_TABS.some((tab) => tab.value === leadStage)
      ? (leadStage as (typeof LEAD_STAGE_TABS)[number]['value'])
      : 'all';
  const filteredContacts =
    isLeadList && activeLeadStage !== 'all'
      ? contacts.filter((contact) => normalizeLeadStage(contact.quality) === activeLeadStage)
      : contacts;
  const columns = isLeadList
    ? ['Date', 'Time', 'Name', 'Email', 'Phone', 'Source', 'Stage']
    : ['Name', 'Email', 'Phone', 'Source', 'Status'];

  return (
    <ModuleShell
      title={title}
      description={description}
      footer={<div id={`${status}-contacts-bulk-controls`} />}
      toolbar={
        isLeadList ? (
          <BackendTabs
            ariaLabel="Lead stage filters"
            activeValue={activeLeadStage}
            items={LEAD_STAGE_TABS.map((tab) => ({
              label: tab.label,
              value: tab.value,
              href: tab.value === 'all' ? '/dashboard/leads' : `/dashboard/leads?stage=${tab.value}`,
            }))}
          />
        ) : undefined
      }
      actions={
        isLeadList ? (
          <Button as="link" href={getContactDetailPath(status, 'new')} variant="btn--primary">
            {createLabel}
          </Button>
        ) : undefined
      }
    >
      <DataTable
        headerAction={
          isLeadList ? undefined : (
            <Button as="link" href={getContactDetailPath(status, 'new')} variant="btn--primary">
              {createLabel}
            </Button>
          )
        }
        columns={columns}
        rows={filteredContacts.map((contact) => ({
          ...(isLeadList
            ? {
                Date: formatDate(contact.created_at),
                Time: formatTime(contact.created_at),
              }
            : {}),
          Name: (
            <Link href={getContactDetailPath(contact.status, contact.id)}>
              {formatName(contact.first_name, contact.last_name)}
            </Link>
          ),
          Email: contact.email ?? '-',
          Phone: contact.phone ? formatPhone(contact.phone) : '-',
          Source: contact.source.replace(/_/g, ' '),
          ...(!isLeadList ? { Status: <StatusBadge status={contact.status} /> } : {}),
          ...(isLeadList ? { Stage: <StatusBadge status={formatQuality(contact.quality)} /> } : {}),
        }))}
        rowHrefs={filteredContacts.map((contact) => getContactDetailPath(contact.status, contact.id))}
        bulkDelete={{
          rowIds: filteredContacts.map((contact) => contact.id),
          onDeleteSelected: deleteContactsBulk,
          itemLabel: title.toLowerCase(),
        }}
        bulkDeletePortalTargetId={`${status}-contacts-bulk-controls`}
        bulkDeleteSelectLabel={`${filteredContacts.length} Total`}
        emptyMessage={`No ${title.toLowerCase()} yet`}
      />
    </ModuleShell>
  );
}
