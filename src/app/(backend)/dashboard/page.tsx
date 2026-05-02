import BackendTabs from '@/components/backend/BackendTabs';
import ModuleShell from '@/components/backend/shell/ModuleShell';
import StatCard from '@/components/backend/StatCard';
import DataTable from '@/components/backend/DataTable';
import DashboardBarChart from '@/components/backend/DashboardBarChart';
import RecentActivity from '@/components/backend/RecentActivity';
import { DASHBOARD_RANGE_OPTIONS, resolveDashboardRange } from '@/lib/dashboard/dateRanges';
import { getOperationsDashboardData } from '@/lib/dashboard/queries';

interface DashboardPageProps {
  searchParams?: Promise<{ range?: string; welcome?: string }>;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatChartCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: value >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 0,
  }).format(value);
}

function buildRangeHref(rangeKey: string) {
  return `/dashboard?range=${encodeURIComponent(rangeKey)}`;
}

function formatOperationsActivity(activity: { id: string; action: string; entity_type: string; created_at: string }) {
  const entityLabel = formatEntityLabel(activity.entity_type);
  const actionText = (activity.action || 'updated').replace(/_/g, ' ').trim();
  const normalizedAction = actionText.toLowerCase();
  const title = `${capitalizeWords(entityLabel)} ${capitalizeWords(actionText)}`;
  const description =
    normalizedAction.startsWith('create') || normalizedAction.startsWith('created')
      ? `${capitalizeWords(entityLabel)} was added to the system.`
      : normalizedAction.startsWith('delete') || normalizedAction.startsWith('deleted')
        ? `${capitalizeWords(entityLabel)} was removed.`
        : `${capitalizeWords(entityLabel)} was updated in the dashboard.`;

  return {
    id: activity.id,
    title,
    description,
    createdAt: activity.created_at,
    tone: getOperationsTone(normalizedAction),
  } as const;
}

function getOperationsTone(action: string) {
  if (action.includes('complete') || action.includes('approve') || action.includes('paid')) return 'success';
  if (action.includes('cancel') || action.includes('delete') || action.includes('overdue')) return 'danger';
  if (action.includes('create') || action.includes('new')) return 'info';
  return 'neutral';
}

function formatEntityLabel(value: string) {
  return (value || 'record').replace(/_/g, ' ');
}

function capitalizeWords(value: string) {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = (searchParams ? await searchParams : {}) ?? {};
  const currentRange = resolveDashboardRange(params.range);
  const showWelcome = params.welcome === '1';
  const { range, jobs, revenue, invoices, estimates, revenueSeries, recentActivity, employees, contacts, communication } =
    await getOperationsDashboardData(currentRange.key);
  const activityItems = recentActivity.map((activity) => formatOperationsActivity(activity));

  return (
    <ModuleShell
      title="Operations"
      description="Performance and team operations in one place."
      toolbar={
        <BackendTabs
          ariaLabel="Operations date range filters"
          activeValue={range.key}
          items={DASHBOARD_RANGE_OPTIONS.map((option) => ({
            label: option.label,
            value: option.key,
            href: buildRangeHref(option.key),
          }))}
        />
      }
    >
      {showWelcome ? (
        <section className="dashboard-panel dashboard-panel--spaced">
          <h2 className="dashboard-panel__title">You&apos;re In</h2>
          <p>
            Your trial dashboard is ready. The starter site, theme, selected services, and uploaded media have been set up for you.
          </p>
          <p>
            Best next steps: review your homepage, update service pages, and check the media library to make sure the brand assets look right.
          </p>
        </section>
      ) : null}

      <div
        className="dashboard__stats"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}
      >
        <StatCard label="Total Jobs" value={formatCount(jobs.total)} icon={<BriefcaseIcon />} />
        <StatCard label="Revenue" value={formatCurrency(revenue.total)} icon={<RevenueIcon />} />
        <StatCard label="Overdue Invoices" value={formatCount(invoices.overdue)} icon={<InvoiceIcon />} />
        <StatCard label="Approved Estimates" value={formatCount(estimates.approved)} icon={<EstimateIcon />} />
        <StatCard label="Customers" value={formatCount(contacts.customers)} icon={<CustomersIcon />} />
        <StatCard label="Emails Out" value={formatCount(communication.emailsSent)} icon={<MailIcon />} />
      </div>

      <div className="dashboard__showcase">
        <section className="dashboard-panel dashboard-panel--showcase">
          <DashboardBarChart
            title="Revenue Growth"
            subtitle={`Collected revenue across ${range.label.toLowerCase()}.`}
            points={revenueSeries}
            formatValue={formatChartCurrency}
          />
        </section>

        <RecentActivity activities={activityItems} actionLabel="Filter" />
      </div>

      <div className="dashboard__grid">
        <section className="dashboard-panel dashboard-panel--chart">
          <h2 className="dashboard-panel__title">Jobs</h2>
          <DataTable
            columns={['Scheduled', 'In Progress', 'Complete', 'Canceled', 'Total']}
            rows={[
              {
                Scheduled: formatCount(jobs.scheduled),
                'In Progress': formatCount(jobs.inProgress),
                Complete: formatCount(jobs.completed),
                Canceled: formatCount(jobs.canceled),
                Total: formatCount(jobs.total),
              },
            ]}
            emptyMessage="No jobs for this range"
          />
        </section>

        <section className="dashboard-panel dashboard-panel--chart">
          <h2 className="dashboard-panel__title">Revenue</h2>
          <DataTable
            columns={['Collected Revenue']}
            rows={[{ 'Collected Revenue': formatCurrency(revenue.total) }]}
            emptyMessage="No revenue for this range"
          />
        </section>
      </div>

      <div className="dashboard__grid">
        <section className="dashboard-panel dashboard-panel--chart">
          <h2 className="dashboard-panel__title">Invoices</h2>
          <DataTable
            columns={['Sent', 'Due', 'Overdue', 'Paid', 'Total', 'Amount', 'Paid Amount']}
            rows={[
              {
                Sent: formatCount(invoices.sent),
                Due: formatCount(invoices.due),
                Overdue: formatCount(invoices.overdue),
                Paid: formatCount(invoices.paid),
                Total: formatCount(invoices.total),
                Amount: formatCurrency(invoices.totalAmount),
                'Paid Amount': formatCurrency(invoices.paidAmount),
              },
            ]}
            emptyMessage="No invoices for this range"
          />
        </section>

        <section className="dashboard-panel dashboard-panel--chart">
          <h2 className="dashboard-panel__title">Estimates</h2>
          <DataTable
            columns={['Sent', 'Approved', 'Rejected', 'Total', 'Total Value']}
            rows={[
              {
                Sent: formatCount(estimates.sent),
                Approved: formatCount(estimates.approved),
                Rejected: formatCount(estimates.rejected),
                Total: formatCount(estimates.total),
                'Total Value': formatCurrency(estimates.totalAmount),
              },
            ]}
            emptyMessage="No estimates for this range"
          />
        </section>
      </div>

      <section className="dashboard-panel dashboard-panel--spaced">
        <h2 className="dashboard-panel__title">Employees</h2>
        <div className="operations-employee-grid">
          {employees.map((employee) => (
            <article key={employee.id} className="operations-employee-card">
              <div className="operations-employee-card__body">
                <h3 className="operations-employee-card__name">{employee.name}</h3>
                <p className="operations-employee-card__role">{employee.title || employee.payType || 'Team member'}</p>
                <div className="operations-employee-card__stats">
                  <span className="operations-employee-card__stat">Pay: {employee.payType || '-'}</span>
                  <span className="operations-employee-card__stat">Rate: {employee.rateLabel}</span>
                  <span className="operations-employee-card__stat">Hours: {employee.hours}</span>
                  <span className="operations-employee-card__stat">Jobs: {employee.jobs}</span>
                  <span className="operations-employee-card__stat">Completed: {employee.completedJobs}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="dashboard__grid">
        <section className="dashboard-panel dashboard-panel--chart">
          <h2 className="dashboard-panel__title">Contacts</h2>
          <DataTable
            columns={['Leads', 'Prospects', 'Customers', 'Prospect Value', 'Customer Value']}
            rows={[
              {
                Leads: formatCount(contacts.leads),
                Prospects: formatCount(contacts.prospects),
                Customers: formatCount(contacts.customers),
                'Prospect Value': formatCurrency(contacts.prospectValue),
                'Customer Value': formatCurrency(contacts.customerValue),
              },
            ]}
            emptyMessage="No contacts for this range"
          />
        </section>

        <section className="dashboard-panel dashboard-panel--chart">
          <h2 className="dashboard-panel__title">Communication</h2>
          <DataTable
            columns={['Emails Out', 'Delivered', 'Opened', 'Clicked']}
            rows={[
              {
                'Emails Out': formatCount(communication.emailsSent),
                Delivered: formatCount(communication.delivered),
                Opened: formatCount(communication.opened),
                Clicked: formatCount(communication.clicked),
              },
            ]}
            emptyMessage="No email activity for this range"
          />
        </section>
      </div>
    </ModuleShell>
  );
}

function BriefcaseIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>; }
function RevenueIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>; }
function InvoiceIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>; }
function EstimateIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>; }
function CustomersIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M16 11l2 2 4-4"/></svg>; }
function MailIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>; }
