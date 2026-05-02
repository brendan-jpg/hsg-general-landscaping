import BackendTabs from '@/components/backend/BackendTabs';
import ModuleShell from '@/components/backend/shell/ModuleShell';
import StatCard from '@/components/backend/StatCard';
import DataTable from '@/components/backend/DataTable';
import DashboardBarChart from '@/components/backend/DashboardBarChart';
import RecentActivity from '@/components/backend/RecentActivity';
import { DASHBOARD_RANGE_OPTIONS, resolveDashboardRange } from '@/lib/dashboard/dateRanges';
import { getDashboardAnalyticsData } from '@/lib/dashboard/queries';

interface AnalyticsDashboardPageProps {
  searchParams?: Promise<{ range?: string }>;
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatDuration(seconds: number) {
  if (seconds <= 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins <= 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function formatChartCount(value: number) {
  return new Intl.NumberFormat('en-US', { notation: value >= 1000 ? 'compact' : 'standard', maximumFractionDigits: 0 }).format(value);
}

function buildRangeHref(rangeKey: string) {
  return `/dashboard/analytics?range=${encodeURIComponent(rangeKey)}`;
}

function formatAnalyticsActivity(event: {
  id: string;
  event_type: string;
  page_url: string | null;
  referrer: string | null;
  created_at: string;
}) {
  const eventType = event.event_type || 'event';
  const pageLabel = normalizePageLabel(event.page_url);
  const eventLabel = formatEventLabel(eventType);
  const title =
    eventType === 'form_submit'
      ? 'New Form Submission'
      : eventType === 'phone_click'
        ? 'Click-to-Call Tracked'
        : eventType === 'cta_click'
          ? 'CTA Click Recorded'
          : `${eventLabel} Recorded`;

  const description =
    eventType === 'page_view'
      ? `${pageLabel} received a new page view${event.referrer ? ` from ${normalizeReferrerLabel(event.referrer)}` : ''}.`
      : `${eventLabel} happened on ${pageLabel}.`;

  return {
    id: event.id,
    title,
    description,
    createdAt: event.created_at,
    tone: eventType === 'form_submit' ? 'success' : eventType === 'phone_click' || eventType === 'cta_click' ? 'info' : 'neutral',
  } as const;
}

function formatEventLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizePageLabel(value: string | null) {
  if (!value) return 'the website';
  const raw = value.trim();
  if (!raw) return 'the website';

  const [withoutHash] = raw.split('#');
  const [pathname, query = ''] = withoutHash.split('?');
  const normalizedPath = pathname.trim() || '/';
  if (!query) return normalizedPath === '/' ? 'the homepage' : normalizedPath;

  const params = new URLSearchParams(query);
  const kept = new URLSearchParams();
  for (const [key, paramValue] of params.entries()) {
    if (key.toLowerCase().startsWith('utm_')) continue;
    if (['fbclid', 'gclid', 'gbraid', 'wbraid', 'mc_cid', 'mc_eid', '_hsenc', '_hsmi'].includes(key.toLowerCase())) continue;
    kept.append(key, paramValue);
  }

  const nextQuery = kept.toString();
  const nextValue = nextQuery ? `${normalizedPath}?${nextQuery}` : normalizedPath;
  return nextValue === '/' ? 'the homepage' : nextValue;
}

function normalizeReferrerLabel(value: string | null) {
  if (!value) return 'direct traffic';

  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return value;
  }
}

export default async function AnalyticsDashboardPage({ searchParams }: AnalyticsDashboardPageProps) {
  const params = (searchParams ? await searchParams : {}) ?? {};
  const currentRange = resolveDashboardRange(params.range);
  const { range, totals, topPages, trafficSeries, recentEvents, referringSources, gbpPerformance, gbpPerformanceError } =
    await getDashboardAnalyticsData(currentRange.key);
  const activityItems = recentEvents.map((event) => formatAnalyticsActivity(event));

  return (
    <ModuleShell
      title="Analytics"
      description="Website, conversion, and GBP performance."
      toolbar={
        <BackendTabs
          ariaLabel="Analytics date range filters"
          activeValue={range.key}
          items={DASHBOARD_RANGE_OPTIONS.map((option) => ({
            label: option.label,
            value: option.key,
            href: buildRangeHref(option.key),
          }))}
        />
      }
    >
      <div
        className="dashboard__stats"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}
      >
        <StatCard label="Page Views" value={totals.pageViews} icon={<PageViewsIcon />} />
        <StatCard label="Unique Sessions" value={totals.uniqueSessions} icon={<SessionsIcon />} />
        <StatCard label="Avg Session Length" value={formatDuration(totals.avgSessionLengthSeconds)} icon={<ClockIcon />} />
        <StatCard label="Form Submissions" value={totals.formSubmissions} icon={<FormIcon />} />
        <StatCard label="Click-to-Calls" value={totals.phoneClicks} icon={<PhoneIcon />} />
        <StatCard label="CTA Clicks" value={totals.ctaClicks} icon={<CursorIcon />} />
      </div>

      <div className="dashboard__showcase">
        <section className="dashboard-panel dashboard-panel--showcase">
          <DashboardBarChart
            title="Traffic Growth"
            subtitle={`Page view trends across ${range.label.toLowerCase()}.`}
            points={trafficSeries}
            formatValue={formatChartCount}
          />
        </section>

        <RecentActivity activities={activityItems} actionLabel="Filter" />
      </div>

      <div className="analytics-dashboard__supporting">
        <section className="dashboard-panel analytics-dashboard__panel analytics-dashboard__panel--table">
          <h2 className="dashboard-panel__title">Top 10 Pages</h2>
          <DataTable
            columns={['Page', 'Views', 'Forms', 'Calls', 'CTAs', 'Conversion']}
            rows={topPages.map((item) => ({
              Page: item.pageUrl,
              Views: formatCount(item.views),
              Forms: formatCount(item.formSubmissions),
              Calls: formatCount(item.phoneClicks),
              CTAs: formatCount(item.ctaClicks),
              Conversion: formatPercent(item.conversionRate),
            }))}
            emptyMessage="No page data for this range"
          />
        </section>

        <section className="dashboard-panel analytics-dashboard__panel analytics-dashboard__panel--table">
          <h2 className="dashboard-panel__title">Referring Sources</h2>
          <DataTable
            columns={['Source', 'Sessions']}
            rows={referringSources.map((item) => ({
              Source: item.source,
              Sessions: formatCount(item.sessions),
            }))}
            emptyMessage="No referral data for this range"
          />
        </section>

        <section className="dashboard-panel analytics-dashboard__panel analytics-dashboard__panel--gbp">
          <h2 className="dashboard-panel__title">Google Business Profile</h2>
          {!gbpPerformance && (
            <p className={gbpPerformanceError ? 'form-error' : undefined}>
              {gbpPerformanceError || 'Google Business Profile is not configured for this business yet.'}
            </p>
          )}
          {gbpPerformance && (
            <>
              <div
                className="dashboard__stats analytics-dashboard__gbp-stats"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-2)' }}
              >
                <StatCard label="Search Impressions" value={formatCount(gbpPerformance.totals.searchImpressions)} icon={<SearchIcon />} />
                <StatCard label="Website Clicks" value={formatCount(gbpPerformance.totals.websiteClicks)} icon={<GlobeIcon />} />
                <StatCard label="Call Clicks" value={formatCount(gbpPerformance.totals.callClicks)} icon={<PhoneIcon />} />
              </div>
            </>
          )}
        </section>
      </div>

    </ModuleShell>
  );
}

function PageViewsIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="3"/></svg>; }
function SessionsIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function ClockIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>; }
function FormIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>; }
function PhoneIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.63 2.62a2 2 0 0 1-.45 2.11L8 9.91a16 16 0 0 0 6.09 6.09l1.46-1.29a2 2 0 0 1 2.11-.45c.84.3 1.72.51 2.62.63A2 2 0 0 1 22 16.92Z"/></svg>; }
function CursorIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m4 4 7.07 17 2.51-7.42L21 11.07 4 4Z"/></svg>; }
function SearchIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>; }
function GlobeIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/></svg>; }
