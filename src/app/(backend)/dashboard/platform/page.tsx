import ModuleShell from '@/components/backend/shell/ModuleShell';
import StatCard from '@/components/backend/StatCard';
import Link from 'next/link';
import PendingSubmitButton from '@/components/backend/PendingSubmitButton';
import {
  createTenantAction,
  deleteBusinessDomainAction,
  runTenantOnboardingAction,
  saveBusinessDomainAction,
  seedBusinessDomainsFromBusinessAction,
} from '@/lib/actions';
import { requirePlatformAdminDashboardPage } from '@/lib/authz/dashboard';
import { buildClientThemeKey, getFrontendThemeFromBusiness, STARTER_THEME_KEY } from '@/lib/frontend/themes';
import { createAdminClient } from '@/lib/supabase/admin';
import { BUSINESS_TIMEZONE_OPTIONS } from '@/lib/timezones';
import type { Tables } from '@/lib/types/database';
import { US_STATE_OPTIONS } from '@/lib/usStates';

type PlatformPageProps = {
  searchParams?: Promise<{
    client?: string;
  }>;
};

type TenantRow = Pick<
  Tables<'businesses'>,
  'id' | 'name' | 'slug' | 'domain' | 'timezone' | 'created_at' | 'settings' | 'email' | 'theme_key'
>;
type DomainRow = Pick<
  Tables<'business_domains'>,
  'id' | 'business_id' | 'domain' | 'canonical_domain' | 'is_active' | 'is_primary'
>;
type SeoRow = Pick<Tables<'seo_settings'>, 'business_id' | 'google_business_profile_url'>;
type QuickBooksRow = Pick<Tables<'quickbooks_connections'>, 'business_id' | 'last_synced_at' | 'last_sync_error'>;
type FormRow = Pick<Tables<'forms'>, 'business_id' | 'is_active'>;
type EmailTemplateRow = Pick<Tables<'email_templates'>, 'business_id' | 'is_active'>;
type FormSubmissionRow = Pick<Tables<'form_submissions'>, 'business_id' | 'created_at'>;

function normalizeHost(value: string | null | undefined) {
  if (!value) return '';
  const first = value.split(',')[0]?.trim() ?? '';
  const withoutPath = first.split('/')[0] ?? first;
  return withoutPath
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/:\d+$/, '')
    .replace(/\/+$/, '');
}

function getSettingsString(settings: unknown, key: string): string {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return '';
  const value = (settings as Record<string, unknown>)[key];
  return typeof value === 'string' ? value.trim() : '';
}

function formatFrontendThemeLabel(theme: string) {
  return theme
    .split('-')
    .map((part) => (part.toLowerCase() === 'hsg' ? 'HSG' : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(' ');
}

function formatDate(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function getTenantDashboardUrl(tenant: TenantRow, domains: DomainRow[]) {
  const preferredDomain =
    domains.find((entry) => entry.is_active && entry.is_primary)?.canonical_domain?.trim() ||
    domains.find((entry) => entry.is_active && entry.is_primary)?.domain?.trim() ||
    domains.find((entry) => entry.is_active && entry.canonical_domain?.trim())?.canonical_domain?.trim() ||
    domains.find((entry) => entry.is_active && entry.domain.trim())?.domain.trim() ||
    tenant.domain?.trim() ||
    '';

  if (!preferredDomain) return '';
  return `https://${normalizeHost(preferredDomain)}/dashboard`;
}

function OfficeIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9h.01"/><path d="M9 13h.01"/><path d="M9 17h.01"/></svg>; }
function CheckCircleIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>; }
function LeadsIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>; }
function PulseIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 7-4-14-3 7H2"/></svg>; }
function GlobeIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/></svg>; }
function AlertIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>; }
function DomainIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h18"/><path d="M12 3a15.3 15.3 0 0 1 0 18"/><path d="M12 3a15.3 15.3 0 0 0 0 18"/><circle cx="12" cy="12" r="9"/></svg>; }
function LedgerIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h16"/><path d="M8 5v14"/></svg>; }

function buildReadinessChecks(options: { settings: unknown; domains: DomainRow[]; reviewUrl: string | null }) {
  const googleBusinessProfileRefreshToken = getSettingsString(options.settings, 'google_business_profile_refresh_token');
  const emailFromAddress = getSettingsString(options.settings, 'email_from_address');
  const emailFromName = getSettingsString(options.settings, 'email_from_name');
  const emailReplyTo = getSettingsString(options.settings, 'email_reply_to');

  const hasPrimaryActiveDomain = options.domains.some((entry) => entry.is_active && entry.is_primary);
  const hasCanonicalDomain = options.domains.some(
    (entry) => entry.is_active && (entry.canonical_domain?.trim() || entry.domain.trim())
  );
  const hasSenderConfig = Boolean(emailFromAddress && (emailFromName || emailReplyTo));
  const hasGoogleConnection = Boolean(googleBusinessProfileRefreshToken);
  const hasReviewUrl = Boolean(options.reviewUrl?.trim());

  const checks = [
    { label: 'Primary active domain', ready: hasPrimaryActiveDomain },
    { label: 'Canonical domain set', ready: hasCanonicalDomain },
    { label: 'Email sender configured', ready: hasSenderConfig },
    { label: 'GBP connected', ready: hasGoogleConnection },
    { label: 'Google review URL set', ready: hasReviewUrl },
  ];

  const readyCount = checks.filter((check) => check.ready).length;
  const percent = Math.round((readyCount / checks.length) * 100);

  return { checks, readyCount, percent };
}

export default async function PlatformPage({ searchParams }: PlatformPageProps) {
  const platformProfile = await requirePlatformAdminDashboardPage();
  const admin = createAdminClient();
  const params = (searchParams ? await searchParams : {}) ?? {};
  const requestedClientId = typeof params.client === 'string' ? params.client.trim() : '';

  const { data: tenantsData, error: tenantsError } = await admin
    .from('businesses')
    .select('id, name, slug, domain, timezone, created_at, settings, email, theme_key')
    .order('created_at', { ascending: false })
    .limit(200);
  if (tenantsError) throw new Error(tenantsError.message);
  const tenants = (tenantsData ?? []) as TenantRow[];

  const selectedTenant =
    tenants.find((tenant) => tenant.id === requestedClientId) ??
    tenants.find((tenant) => tenant.id === platformProfile.business_id) ??
    tenants[0] ??
    null;
  const selectedTenantId = selectedTenant?.id ?? '';

  const tenantIds = tenants.map((tenant) => tenant.id);
  const now = new Date();
  const since7dDate = new Date(now);
  since7dDate.setDate(since7dDate.getDate() - 7);
  const since30dDate = new Date(now);
  since30dDate.setDate(since30dDate.getDate() - 30);
  const since7d = since7dDate.toISOString();
  const since30d = since30dDate.toISOString();
  const [
    { data: allDomainsData, error: allDomainsError },
    { data: allSeoData, error: allSeoError },
    { data: quickBooksData, error: quickBooksError },
    { data: formsData, error: formsError },
    { data: emailTemplatesData, error: emailTemplatesError },
    { data: recentLeadsData, error: recentLeadsError },
    { count: globalLeads30dCount, error: globalLeads30dError },
    { count: globalEvents7dCount, error: globalEvents7dError },
  ] = await Promise.all([
    tenantIds.length > 0
      ? admin
          .from('business_domains')
          .select('id, business_id, domain, canonical_domain, is_active, is_primary')
          .in('business_id', tenantIds)
      : Promise.resolve({ data: [], error: null }),
    tenantIds.length > 0
      ? admin
          .from('seo_settings')
          .select('business_id, google_business_profile_url')
          .in('business_id', tenantIds)
      : Promise.resolve({ data: [], error: null }),
    tenantIds.length > 0
      ? admin
          .from('quickbooks_connections')
          .select('business_id, last_synced_at, last_sync_error')
          .in('business_id', tenantIds)
      : Promise.resolve({ data: [], error: null }),
    tenantIds.length > 0
      ? admin
          .from('forms')
          .select('business_id, is_active')
          .in('business_id', tenantIds)
      : Promise.resolve({ data: [], error: null }),
    tenantIds.length > 0
      ? admin
          .from('email_templates')
          .select('business_id, is_active')
          .in('business_id', tenantIds)
      : Promise.resolve({ data: [], error: null }),
    tenantIds.length > 0
      ? admin
          .from('form_submissions')
          .select('business_id, created_at')
          .in('business_id', tenantIds)
          .gte('created_at', since30d)
          .order('created_at', { ascending: false })
          .limit(5000)
      : Promise.resolve({ data: [], error: null }),
    tenantIds.length > 0
      ? admin
          .from('form_submissions')
          .select('*', { count: 'exact', head: true })
          .in('business_id', tenantIds)
          .gte('created_at', since30d)
      : Promise.resolve({ count: 0, error: null }),
    tenantIds.length > 0
      ? admin
          .from('analytics_events')
          .select('*', { count: 'exact', head: true })
          .in('business_id', tenantIds)
          .gte('created_at', since7d)
      : Promise.resolve({ count: 0, error: null }),
  ]);
  if (allDomainsError) throw new Error(allDomainsError.message);
  if (allSeoError) throw new Error(allSeoError.message);
  if (quickBooksError) throw new Error(quickBooksError.message);
  if (formsError) throw new Error(formsError.message);
  if (emailTemplatesError) throw new Error(emailTemplatesError.message);
  if (recentLeadsError) throw new Error(recentLeadsError.message);
  if (globalLeads30dError) throw new Error(globalLeads30dError.message);
  if (globalEvents7dError) throw new Error(globalEvents7dError.message);

  const allDomains = (allDomainsData ?? []) as DomainRow[];
  const allSeo = (allSeoData ?? []) as SeoRow[];
  const quickBooksConnections = (quickBooksData ?? []) as QuickBooksRow[];
  const allForms = (formsData ?? []) as FormRow[];
  const allEmailTemplates = (emailTemplatesData ?? []) as EmailTemplateRow[];
  const recentLeads = (recentLeadsData ?? []) as FormSubmissionRow[];

  const quickBooksByBusinessId = new Map<string, QuickBooksRow>();
  for (const row of quickBooksConnections) {
    quickBooksByBusinessId.set(row.business_id, row);
  }

  const formCountsByBusinessId = new Map<string, { total: number; active: number }>();
  for (const row of allForms) {
    const current = formCountsByBusinessId.get(row.business_id) ?? { total: 0, active: 0 };
    current.total += 1;
    if (row.is_active) current.active += 1;
    formCountsByBusinessId.set(row.business_id, current);
  }

  const templateCountsByBusinessId = new Map<string, { total: number; active: number }>();
  for (const row of allEmailTemplates) {
    const current = templateCountsByBusinessId.get(row.business_id) ?? { total: 0, active: 0 };
    current.total += 1;
    if (row.is_active) current.active += 1;
    templateCountsByBusinessId.set(row.business_id, current);
  }

  const leads30dByBusinessId = new Map<string, number>();
  for (const row of recentLeads) {
    leads30dByBusinessId.set(row.business_id, (leads30dByBusinessId.get(row.business_id) ?? 0) + 1);
  }
  const domainsByBusinessId = new Map<string, DomainRow[]>();
  for (const domain of allDomains) {
    const list = domainsByBusinessId.get(domain.business_id) ?? [];
    list.push(domain);
    domainsByBusinessId.set(domain.business_id, list);
  }
  const reviewUrlByBusinessId = new Map<string, string>();
  for (const row of allSeo) {
    if (row.google_business_profile_url?.trim()) {
      reviewUrlByBusinessId.set(row.business_id, row.google_business_profile_url.trim());
    }
  }

  const selectedDomains = selectedTenantId ? domainsByBusinessId.get(selectedTenantId) ?? [] : [];

  const activeDomainCount = allDomains.filter((entry) => entry.is_active).length;
  const clientsWithQuickBooks = quickBooksConnections.length;
  const clientsWithQuickBooksErrors = quickBooksConnections.filter((row) => Boolean(row.last_sync_error?.trim())).length;
  const clientsWithGbp = tenants.filter((tenant) =>
    Boolean(getSettingsString(tenant.settings, 'google_business_profile_refresh_token'))
  ).length;
  const readyClientsCount = tenants.filter((tenant) => {
    const checks = buildReadinessChecks({
      settings: tenant.settings,
      domains: domainsByBusinessId.get(tenant.id) ?? [],
      reviewUrl: reviewUrlByBusinessId.get(tenant.id) ?? null,
    });
    return checks.percent === 100;
  }).length;

  const platformClientRows = tenants
    .map((tenant) => {
      const readiness = buildReadinessChecks({
        settings: tenant.settings,
        domains: domainsByBusinessId.get(tenant.id) ?? [],
        reviewUrl: reviewUrlByBusinessId.get(tenant.id) ?? null,
      });
      const tenantDomains = domainsByBusinessId.get(tenant.id) ?? [];
      const activeThemeKey = getFrontendThemeFromBusiness(tenant) ?? buildClientThemeKey(tenant.slug) ?? STARTER_THEME_KEY;
      const primaryDomain =
        tenantDomains.find((entry) => entry.is_active && entry.is_primary)?.canonical_domain?.trim() ||
        tenantDomains.find((entry) => entry.is_active && entry.is_primary)?.domain?.trim() ||
        tenant.domain?.trim() ||
        '';

      return {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        domain: primaryDomain,
        domainCount: tenantDomains.length,
        readiness: readiness.percent,
        leads30d: leads30dByBusinessId.get(tenant.id) ?? 0,
        createdAt: tenant.created_at,
        activeThemeKey,
        dashboardUrl: getTenantDashboardUrl(tenant, tenantDomains),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <ModuleShell title="Platform" description="Internal client onboarding and domain operations">
      <div className="platform-page">
        <div
          className="dashboard__stats platform-dashboard__stats"
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3)' }}
        >
          <StatCard label="Clients" value={formatNumber(tenants.length)} icon={<OfficeIcon />} />
          <StatCard label="Ready Clients" value={formatNumber(readyClientsCount)} icon={<CheckCircleIcon />} />
          <StatCard label="Leads (30d)" value={formatNumber(globalLeads30dCount ?? 0)} icon={<LeadsIcon />} />
          <StatCard label="Site Events (7d)" value={formatNumber(globalEvents7dCount ?? 0)} icon={<PulseIcon />} />
          <StatCard label="GBP Connected" value={formatNumber(clientsWithGbp)} icon={<GlobeIcon />} />
          <StatCard label="QuickBooks Issues" value={formatNumber(clientsWithQuickBooksErrors)} icon={<AlertIcon />} />
          <StatCard label="Active Domains" value={formatNumber(activeDomainCount)} icon={<DomainIcon />} />
          <StatCard label="QB Connected" value={formatNumber(clientsWithQuickBooks)} icon={<LedgerIcon />} />
        </div>

        <section className="settings-card">
          <div className="platform-section__head platform-section__head--split">
            <div>
              <h3>Clients</h3>
              <p>Each row gives you the essentials: theme selection, editor access, dashboard access, and client status.</p>
            </div>
            <div className="platform-client-table__header-actions">
              <a className="btn btn--secondary btn--sm" href="#new-client-form">
                + Client
              </a>
              {selectedTenant ? (
                <div className="platform-client-table__selection">
                  Active client
                  <strong>{selectedTenant.name}</strong>
                </div>
              ) : null}
            </div>
          </div>
          {platformClientRows.length > 0 ? (
            <div className="platform-table-wrap">
              <table className="platform-table platform-client-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Domain</th>
                    <th>Theme</th>
                    <th>Leads 30d</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {platformClientRows.map((row) => (
                    <tr key={row.id} className={row.id === selectedTenantId ? 'platform-table__row--active' : ''}>
                      <td>
                        <Link className="platform-client-table__cell-link" href={`/dashboard/platform?client=${encodeURIComponent(row.id)}`}>
                          <div className="platform-client-table__identity">
                            <strong>{row.name}</strong>
                            <code>{row.slug}</code>
                          </div>
                        </Link>
                      </td>
                      <td>
                        <Link className="platform-client-table__cell-link" href={`/dashboard/platform?client=${encodeURIComponent(row.id)}`}>
                          <div className="platform-client-table__domain">
                            <span>{row.domain || 'No domain set'}</span>
                            <small>{row.domainCount} domain{row.domainCount === 1 ? '' : 's'}</small>
                          </div>
                        </Link>
                      </td>
                      <td>
                        <code className="platform-client-table__theme-key">{row.activeThemeKey}</code>
                      </td>
                      <td>
                        <Link className="platform-client-table__cell-link" href={`/dashboard/platform?client=${encodeURIComponent(row.id)}`}>
                          <span className="platform-client-table__metric">{formatNumber(row.leads30d)}</span>
                        </Link>
                      </td>
                      <td>
                        <Link className="platform-client-table__cell-link" href={`/dashboard/platform?client=${encodeURIComponent(row.id)}`}>
                          {formatDate(row.createdAt)}
                        </Link>
                      </td>
                      <td>
                        <div className="platform-client-table__actions">
                          <Link className="btn btn--ghost btn--sm" href={`/platform/theme?client=${encodeURIComponent(row.id)}`} target="_blank" rel="noreferrer">
                            Theme
                          </Link>
                          {row.dashboardUrl ? (
                            <a className="btn btn--secondary btn--sm" href={row.dashboardUrl} target="_blank" rel="noreferrer">
                              Dashboard
                            </a>
                          ) : (
                            <span className="platform-client-table__missing">No dashboard</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="platform-empty">No clients found.</p>
          )}
        </section>

        <div className="platform-grid">
          <section className="dashboard-panel platform-dashboard__panel platform-create-client" id="new-client-form">
            <div className="platform-section__head">
              <h3 className="dashboard-panel__title">New Client</h3>
              <p>Create the tenant, upload the logo, and seed the main domain in one step.</p>
            </div>
            <form action={createTenantAction} className="platform-form platform-form--two-col">
              <label>
                Business Name
                <input name="name" type="text" required placeholder="Acme Roofing" />
              </label>
              <label>
                Domain
                <input name="primary_domain" type="text" placeholder="www.acmeroofing.com" />
              </label>
              <label>
                Email
                <input name="email" type="email" placeholder="hello@acmeroofing.com" />
              </label>
              <label>
                Phone
                <input name="phone" type="tel" placeholder="555-555-5555" />
              </label>
              <label className="platform-form__span-two">
                Address
                <input name="address_line1" type="text" placeholder="123 Main St" />
              </label>
              <label>
                City
                <input name="city" type="text" placeholder="Dallas" />
              </label>
              <label>
                State
                <select name="state" defaultValue="">
                  <option value="">Select state</option>
                  {US_STATE_OPTIONS.map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Zip
                <input name="zip" type="text" placeholder="75201" />
              </label>
              <label>
                Logo
                <input name="logo" type="file" accept="image/*" />
              </label>
              <label>
                Slug (optional)
                <input name="slug" type="text" placeholder="auto-generated if blank" />
              </label>
              <label>
                Timezone
                <select name="timezone" defaultValue="America/New_York">
                  {BUSINESS_TIMEZONE_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label} ({value})
                    </option>
                  ))}
                </select>
              </label>
              <PendingSubmitButton idleLabel="Create Client" pendingLabel="Creating..." />
            </form>
          </section>

          <section className="settings-card">
            <div className="platform-section__head">
              <h3>Selected Client Domain Operations</h3>
              <p>
                {selectedTenant
                  ? `Advanced domain management for ${selectedTenant.name}.`
                  : 'Pick a client from the table above to manage domains.'}
              </p>
            </div>
            {selectedTenantId ? (
              <>
                <form action={runTenantOnboardingAction} className="platform-dashboard__overview-action">
                  <input type="hidden" name="business_id" value={selectedTenantId} />
                  <PendingSubmitButton idleLabel="Run Client Onboarding" />
                </form>
                <form action={seedBusinessDomainsFromBusinessAction} className="platform-inline-form">
                  <input type="hidden" name="business_id" value={selectedTenantId} />
                  <button type="submit" className="btn btn--secondary">
                    Seed WWW Canonical + Apex Alias
                  </button>
                </form>
              </>
            ) : null}
          </section>
        </div>

        <details className="platform-collapsible settings-card">
          <summary className="platform-collapsible__summary">
            Domain Operations
            <span className="platform-collapsible__hint">Advanced</span>
          </summary>
          <div className="platform-section__head">
            <p>Map domains and control canonical redirects for the selected client.</p>
          </div>
          <form action={saveBusinessDomainAction} className="platform-form platform-form--domain-create">
            <input type="hidden" name="business_id" value={selectedTenantId} />
            <label>
              Domain
              <input name="domain" type="text" required placeholder="clientdomain.com" />
            </label>
            <label>
              Canonical Domain
              <input name="canonical_domain" type="text" placeholder="www.clientdomain.com" />
            </label>
            <label className="platform-checkbox">
              <input name="is_primary" type="checkbox" />
              Primary
            </label>
            <label className="platform-checkbox">
              <input name="is_active" type="checkbox" defaultChecked />
              Active
            </label>
            <PendingSubmitButton idleLabel="Add Domain" />
          </form>

          {selectedDomains.length === 0 ? (
            <p className="platform-empty">No domains configured yet.</p>
          ) : (
            <div className="platform-domain-list">
              {selectedDomains.map((domainEntry) => (
                <form key={domainEntry.id} action={saveBusinessDomainAction} className="platform-domain-row">
                  <input type="hidden" name="id" value={domainEntry.id} />
                  <input type="hidden" name="business_id" value={selectedTenantId} />
                  <label>
                    Domain
                    <input name="domain" type="text" required defaultValue={domainEntry.domain} />
                  </label>
                  <label>
                    Canonical Domain
                    <input
                      name="canonical_domain"
                      type="text"
                      defaultValue={domainEntry.canonical_domain ?? ''}
                      placeholder="www.clientdomain.com"
                    />
                  </label>
                  <label className="platform-checkbox">
                    <input name="is_primary" type="checkbox" defaultChecked={domainEntry.is_primary} />
                    Primary
                  </label>
                  <label className="platform-checkbox">
                    <input name="is_active" type="checkbox" defaultChecked={domainEntry.is_active} />
                    Active
                  </label>
                  <div className="platform-domain-row__actions">
                    <PendingSubmitButton idleLabel="Save" />
                    <button
                      type="submit"
                      className="btn btn--danger"
                      formAction={async () => {
                        'use server';
                        await deleteBusinessDomainAction(domainEntry.id, selectedTenantId);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </form>
              ))}
            </div>
          )}
        </details>
      </div>
    </ModuleShell>
  );
}
