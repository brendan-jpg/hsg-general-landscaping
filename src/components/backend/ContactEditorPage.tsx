import { notFound, redirect } from 'next/navigation';
import ModuleShell from '@/components/backend/shell/ModuleShell';
import ContactEditorForm from '@/components/backend/ContactEditorForm';
import ContactFilesPanel from '@/components/backend/ContactFilesPanel';
import DataTable from '@/components/backend/DataTable';
import StatusBadge from '@/components/shared/StatusBadge';
import { getContactDetailPath } from '@/lib/contacts/routing';
import { markLeadNotificationsReadForContact } from '@/lib/notifications/queries';
import {
  getDashboardContactActivityLog,
  getDashboardContactById,
  getDashboardContactEmailLog,
  getDashboardContactEstimates,
  getDashboardContactFiles,
  getDashboardContactFormSubmissions,
  getDashboardContactInvoices,
  getDashboardContactJobs,
} from '@/lib/contacts/queries';
import { formatDateTime } from '@/lib/utils';
import type { Tables } from '@/lib/types/database';

interface ContactEditorPageProps {
  id: string;
  status: Tables<'contacts'>['status'];
  singularLabel: string;
}

function formatName(firstName: string | null, lastName: string | null) {
  const full = [firstName, lastName].filter(Boolean).join(' ').trim();
  return full || 'Contact';
}

function formatSubmissionSourceLabel(formType: Tables<'form_submissions'>['form_type']) {
  return formType
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getSubmissionDataValue(data: Tables<'form_submissions'>['data'], key: string) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return '-';
  const value = (data as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value.trim() : '-';
}

function formatDateTimeWithoutSeconds(value: string | null | undefined) {
  if (!value) return '-';
  return formatDateTime(value);
}

export default async function ContactEditorPage({
  id,
  status,
  singularLabel,
}: ContactEditorPageProps) {
  const isNew = id === 'new';
  const isLeadDetail = status === 'lead';
  const isProspectDetail = status === 'prospect';
  const contact = isNew ? null : await getDashboardContactById(id);
  if (!isNew && !contact) notFound();

  if (!isNew && contact && contact.status !== status) {
    redirect(getContactDetailPath(contact.status, contact.id));
  }

  if (!isNew && contact && status === 'lead') {
    await markLeadNotificationsReadForContact(contact.id);
  }

  const [jobs, estimates, invoices, emailLog, formSubmissions, activityLog, files] = isNew
    ? [[], [], [], [], [], [], []]
    : await Promise.all([
        getDashboardContactJobs(id),
        getDashboardContactEstimates(id),
        getDashboardContactInvoices(id),
        getDashboardContactEmailLog(id),
        getDashboardContactFormSubmissions(id),
        getDashboardContactActivityLog(id),
        getDashboardContactFiles(id),
      ]);
  const totalInvoiced = invoices.reduce((sum, invoice) => sum + (invoice.total ?? 0), 0);
  const totalPaid = invoices.reduce((sum, invoice) => sum + (invoice.amount_paid ?? 0), 0);
  const latestEstimate = estimates[0] ?? null;

  return (
    <ModuleShell
      title={isNew ? `New ${singularLabel}` : `Edit ${formatName(contact?.first_name ?? null, contact?.last_name ?? null)}`}
    >
      <ContactEditorForm
        contact={contact}
        activityLog={activityLog}
        initialStatus={status}
        latestEstimateId={latestEstimate?.id ?? null}
        bottomContent={
          !isNew && contact ? (
            <div className="contact-detail">
              {!isLeadDetail ? (
                <>
                  {!isProspectDetail ? (
                    <>
                      <section className="contact-detail__jobs">
                        <h3>Jobs</h3>
                        <DataTable
                          columns={['Title', 'Status', 'Scheduled']}
                          rows={jobs.map((job) => ({
                            Title: job.title,
                            Status: <StatusBadge status={job.status} />,
                            Scheduled: job.scheduled_start ? formatDateTime(job.scheduled_start) : '-',
                          }))}
                          rowHrefs={jobs.map((job) => `/dashboard/jobs/${job.id}`)}
                          emptyMessage="No jobs for this contact"
                        />
                      </section>

                      <section className="contact-detail__invoices">
                        <h3>Invoices</h3>
                        <p className="contact-detail__summary">
                          Total invoiced: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalInvoiced)} | Total paid:{' '}
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalPaid)}
                        </p>
                        <DataTable
                          columns={['Invoice #', 'Status', 'Total', 'Paid', 'Due Date']}
                          rows={invoices.map((invoice) => ({
                            'Invoice #': invoice.invoice_number,
                            Status: <StatusBadge status={invoice.status} />,
                            Total: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(invoice.total ?? 0),
                            Paid: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(invoice.amount_paid ?? 0),
                            'Due Date': invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : '-',
                          }))}
                          rowHrefs={invoices.map((invoice) => `/dashboard/invoices/${invoice.id}`)}
                          emptyMessage="No invoices for this contact"
                        />
                      </section>
                    </>
                  ) : null}

                  <section className="contact-detail__notes">
                    <h3>Estimates</h3>
                    <DataTable
                      columns={['Estimate #', 'Status', 'Total', 'Valid Until']}
                      rows={estimates.map((estimate) => ({
                        'Estimate #': estimate.estimate_number,
                        Status: <StatusBadge status={estimate.status} />,
                        Total: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(estimate.total ?? 0),
                        'Valid Until': estimate.valid_until ? new Date(estimate.valid_until).toLocaleDateString() : '-',
                      }))}
                      rowHrefs={estimates.map((estimate) => `/dashboard/estimates/${estimate.id}`)}
                      emptyMessage="No estimates for this contact"
                    />
                  </section>
                </>
              ) : null}

              <section className="contact-detail__submissions">
                <h3>Form Submissions</h3>
                <DataTable
                  columns={['Source', 'Message', 'Page', 'Submitted']}
                  rows={formSubmissions.map((submission) => ({
                    Source: formatSubmissionSourceLabel(submission.form_type),
                    Message: getSubmissionDataValue(submission.data, 'message'),
                    Page: submission.page_url || '-',
                    Submitted: formatDateTimeWithoutSeconds(submission.created_at),
                  }))}
                  emptyMessage="No form submissions for this contact"
                />
              </section>

              {isLeadDetail ? <ContactFilesPanel contactId={contact.id} files={files} /> : null}

              <section className="contact-detail__emails">
                <h3>Email Log</h3>
                <DataTable
                  columns={['Subject', 'To', 'Status', 'Sent']}
                  rows={emailLog.map((entry) => ({
                    Subject: entry.subject,
                    To: entry.to_email,
                    Status: <StatusBadge status={entry.status} />,
                    Sent: entry.sent_at ? formatDateTime(entry.sent_at) : '-',
                  }))}
                  emptyMessage="No emails for this contact"
                />
              </section>
            </div>
          ) : null
        }
      />
    </ModuleShell>
  );
}
