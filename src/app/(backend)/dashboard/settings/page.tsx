import ModuleShell from '@/components/backend/shell/ModuleShell';
import BusinessUsersManager from '@/components/backend/BusinessUsersManager';
import Link from 'next/link';
import BackendTabs from '@/components/backend/BackendTabs';
import DataTable from '@/components/backend/DataTable';
import SettingsContentImportForm from '@/components/backend/SettingsContentImportForm';
import BusinessLogoField from '@/components/backend/BusinessLogoField';
import FooterBuilderField from '@/components/backend/FooterBuilderField';
import HeaderNavBuilderField from '@/components/backend/HeaderNavBuilderField';
import LicenseNumbersField from '@/components/backend/LicenseNumbersField';
import PendingSubmitButton from '@/components/backend/PendingSubmitButton';
import QuickBooksItemsManager from '@/components/backend/QuickBooksItemsManager';
import ContentDefaultsSettingsTable from '@/components/backend/ContentDefaultsSettingsTable';
import Button from '@/components/shared/Button';
import {
  disconnectQuickBooksConnectionAction,
  deleteRedirectAction,
  runFullQuickBooksReconcileAction,
  saveFooterBuilderSettingsAction,
  saveHeaderNavigationSettingsAction,
  saveBusinessSettingsAction,
  saveRedirectAction,
  saveSeoSettingsAction,
} from '@/lib/actions';
import { getDashboardSettingsData } from '@/lib/dashboard/queries';
import { getDashboardBlogPosts, getDashboardPages, getDashboardAreas, getDashboardTestimonials } from '@/lib/content/queries';
import { parseFooterBuilderConfigFromBusinessSettings } from '@/lib/navigation/footerBuilder';
import { parseHeaderNavConfigFromBusinessSettings } from '@/lib/navigation/headerNavigation';
import { getDashboardServices } from '@/lib/services/queries';
import { getAreaDetailBaseSegment, getServiceDetailBaseSegment } from '@/lib/utils/publicPaths';
import { parseBusinessLicenses } from '@/lib/utils/licenses';
import { getManagedBusinessUsers } from '@/lib/users/queries';
import { requireAdminDashboardPage } from '@/lib/authz/dashboard';
import { listQuickBooksItemsForBusiness } from '@/lib/integrations/quickbooks';
import { BUSINESS_TIMEZONE_OPTIONS, normalizeBusinessTimezone } from '@/lib/timezones';
import { US_STATE_OPTIONS } from '@/lib/usStates';
import { formatDateTime, formatPhone } from '@/lib/utils';

interface SettingsPageProps {
  searchParams?: Promise<{
    quickbooks?: string;
    message?: string;
    synced?: string;
    created?: string;
    linked?: string;
    failed?: string;
    last_error?: string;
    google?: string;
    google_message?: string;
    tab?: string;
  }>;
}

const DEFAULT_SERVICE_META_TITLE_TEMPLATE = '{{service}} Services | {{business}}';
const DEFAULT_SERVICE_META_DESCRIPTION_TEMPLATE =
  'Professional {{service}} services from {{business}} in {{primary_area}}, {{state_code}}. Contact us today for expert help.';
const DEFAULT_SERVICE_H1_TEMPLATE = 'Pro {{service}} Services';
const DEFAULT_SERVICE_URL_TEMPLATE = '{{service}}';

const DEFAULT_AREA_META_TITLE_TEMPLATE = '{{primary_service}} in {{area}}, {{state_code}} | {{business}}';
const DEFAULT_AREA_META_DESCRIPTION_TEMPLATE =
  'Need {{primary_service}} in {{area}}, {{state_code}}? {{business}} provides trusted local service and fast scheduling.';
const DEFAULT_AREA_H1_TEMPLATE = '{{primary_service}} in {{area}}, {{state_code}}';
const DEFAULT_AREA_URL_TEMPLATE = '{{primary_service}}-{{area}}-{{state_code}}';

const SETTINGS_TABS = [
  { label: 'Users', value: 'users' },
  { label: 'Business', value: 'business' },
  { label: 'Content', value: 'content' },
  { label: 'SEO', value: 'seo' },
  { label: 'Google', value: 'google' },
  { label: 'Quickbooks', value: 'quickbooks' },
  { label: 'Header', value: 'header' },
  { label: 'Footer', value: 'footer' },
  { label: 'Import', value: 'import' },
] as const;

type SettingsTab = (typeof SETTINGS_TABS)[number]['value'];

function getSettingsStringArray(settings: unknown, key: string): string[] {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return [];
  const value = (settings as Record<string, unknown>)[key];
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getSettingsString(settings: unknown, key: string): string {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return '';
  const value = (settings as Record<string, unknown>)[key];
  return typeof value === 'string' ? value.trim() : '';
}

function getSettingsBoolean(settings: unknown, key: string): boolean {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return false;
  return (settings as Record<string, unknown>)[key] === true;
}

function getSettingsNumber(settings: unknown, key: string): number | null {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return null;
  const value = (settings as Record<string, unknown>)[key];
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function BusinessSettingsHiddenInputs({
  business,
  teamTitleTypes,
  contactFormId,
  faviconUrl,
}: {
  business: Awaited<ReturnType<typeof getDashboardSettingsData>>['business'];
  teamTitleTypes: string[];
  contactFormId: string;
  faviconUrl: string;
}) {
  return (
    <>
      <input type="hidden" name="name" value={business?.name ?? ''} />
      <input type="hidden" name="phone" value={business?.phone ?? ''} />
      <input type="hidden" name="email" value={business?.email ?? ''} />
      <input type="hidden" name="domain" value={business?.domain ?? ''} />
      <input type="hidden" name="logo_url" value={business?.logo_url ?? ''} />
      <input type="hidden" name="address_line1" value={business?.address_line1 ?? ''} />
      <input type="hidden" name="address_line2" value={business?.address_line2 ?? ''} />
      <input type="hidden" name="city" value={business?.city ?? ''} />
      <input type="hidden" name="state" value={business?.state ?? ''} />
      <input type="hidden" name="zip" value={business?.zip ?? ''} />
      <input type="hidden" name="timezone" value={business?.timezone ?? 'America/New_York'} />
      <input type="hidden" name="team_title_types" value={teamTitleTypes.join('\n')} />
      <input type="hidden" name="contact_form_id" value={contactFormId} />
      <input type="hidden" name="favicon_url" value={faviconUrl} />
    </>
  );
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const dashboardProfile = await requireAdminDashboardPage();
  const query = (searchParams ? await searchParams : {}) ?? {};
  const [{ business, seoSettings, quickBooksConnection, redirects }, blogPosts, pages, services, Areas, testimonials] = await Promise.all([
    getDashboardSettingsData(),
    getDashboardBlogPosts(),
    getDashboardPages(),
    getDashboardServices(),
    getDashboardAreas(),
    getDashboardTestimonials(),
  ]);
  const quickBooksItems =
    quickBooksConnection && business?.id
      ? await listQuickBooksItemsForBusiness(business.id).catch(() => [])
      : [];
  const teamTitleTypes = getSettingsStringArray(business?.settings, 'team_title_types');
  const contactFormId = getSettingsString(business?.settings, 'contact_form_id');
  const faviconUrl = getSettingsString(business?.settings, 'favicon_url');
  const serviceDefaultTitleTemplate =
    getSettingsString(business?.settings, 'service_default_title_template') || DEFAULT_SERVICE_META_TITLE_TEMPLATE;
  const serviceDefaultMetaDescriptionTemplate =
    getSettingsString(business?.settings, 'service_default_meta_description_template') ||
    DEFAULT_SERVICE_META_DESCRIPTION_TEMPLATE;
  const serviceDefaultH1Template =
    getSettingsString(business?.settings, 'service_default_h1_template') || DEFAULT_SERVICE_H1_TEMPLATE;
  const serviceDefaultUrlTemplate =
    getSettingsString(business?.settings, 'service_default_url_template') || DEFAULT_SERVICE_URL_TEMPLATE;
  const serviceDefaultIcon = getSettingsString(business?.settings, 'service_default_icon');
  const showServiceCardExcerpts = getSettingsBoolean(business?.settings, 'service_card_show_excerpts');
  const serviceDetailBasePath = getServiceDetailBaseSegment(business?.settings);
  const AreaDefaultTitleTemplate =
    getSettingsString(business?.settings, 'area_default_title_template') || DEFAULT_AREA_META_TITLE_TEMPLATE;
  const areaDefaultMetaDescriptionTemplate =
    getSettingsString(business?.settings, 'area_default_meta_description_template') ||
    DEFAULT_AREA_META_DESCRIPTION_TEMPLATE;
  const AreaDefaultH1Template =
    getSettingsString(business?.settings, 'area_default_h1_template') || DEFAULT_AREA_H1_TEMPLATE;
  const AreaDefaultUrlTemplate =
    getSettingsString(business?.settings, 'area_default_url_template') || DEFAULT_AREA_URL_TEMPLATE;
  const areaDefaultIcon = getSettingsString(business?.settings, 'area_default_icon');
  const showAreaCardExcerpts = getSettingsBoolean(business?.settings, 'area_card_show_excerpts');
  const areaDetailBasePath = getAreaDetailBaseSegment(business?.settings);
  const googleBusinessProfileAccountId = getSettingsString(business?.settings, 'google_business_profile_account_id');
  const googleBusinessProfileLocationId = getSettingsString(business?.settings, 'google_business_profile_location_id');
  const googleBusinessProfileRefreshToken = getSettingsString(business?.settings, 'google_business_profile_refresh_token');
  const defaultTaxRate = getSettingsNumber(business?.settings, 'default_tax_rate');
  const emailFromName = getSettingsString(business?.settings, 'email_from_name');
  const emailFromAddress = getSettingsString(business?.settings, 'email_from_address');
  const emailReplyTo = getSettingsString(business?.settings, 'email_reply_to');
  const primaryCtaLabel = getSettingsString(business?.settings, 'primary_cta_label');
  const secondaryCtaLabel = getSettingsString(business?.settings, 'secondary_cta_label');
  const secondaryCtaLink = getSettingsString(business?.settings, 'secondary_cta_link');
  const licenseNumbers = parseBusinessLicenses(
    business?.settings && typeof business.settings === 'object' && !Array.isArray(business.settings)
      ? (business.settings as Record<string, unknown>).license_numbers
      : [],
  );
  const headerNavConfig = parseHeaderNavConfigFromBusinessSettings(business?.settings);
  const footerBuilderConfig = parseFooterBuilderConfigFromBusinessSettings(business?.settings);
  const managedUsers = business?.id ? await getManagedBusinessUsers(business.id) : [];
  const tabParam = typeof query.tab === 'string' ? query.tab.toLowerCase() : '';
  const normalizedTabParam = tabParam === 'services' || tabParam === 'areas' ? 'content' : tabParam;
  const activeTab = SETTINGS_TABS.some((tab) => tab.value === normalizedTabParam) ? (normalizedTabParam as SettingsTab) : 'users';
  const getTabHref = (tab: SettingsTab) => {
    const params = new URLSearchParams();
    if (tab !== 'users') params.set('tab', tab);
    if (typeof query.quickbooks === 'string') params.set('quickbooks', query.quickbooks);
    if (typeof query.message === 'string' && query.message) params.set('message', query.message);
    if (typeof query.synced === 'string' && query.synced) params.set('synced', query.synced);
    if (typeof query.created === 'string' && query.created) params.set('created', query.created);
    if (typeof query.linked === 'string' && query.linked) params.set('linked', query.linked);
    if (typeof query.failed === 'string' && query.failed) params.set('failed', query.failed);
    if (typeof query.last_error === 'string' && query.last_error) params.set('last_error', query.last_error);
    if (typeof query.google === 'string') params.set('google', query.google);
    if (typeof query.google_message === 'string' && query.google_message) {
      params.set('google_message', query.google_message);
    }
    const qs = params.toString();
    return qs ? `/dashboard/settings?${qs}` : '/dashboard/settings';
  };

  return (
    <ModuleShell title="Settings" description="Manage business, SEO, menus, and redirects">
      <div className="settings-page">
        <BackendTabs
          ariaLabel="Settings tabs"
          activeValue={activeTab}
          items={SETTINGS_TABS.map((tab) => ({
            ...tab,
            href: getTabHref(tab.value),
          }))}
        />

        {activeTab === 'business' && (
          <div className="settings-tab-panel">
            <div className="settings__section settings-card settings-panel">
              <div className="settings-panel__head">
                <span className="settings-panel__eyebrow">Business Profile</span>
              </div>
            <form action={saveBusinessSettingsAction} className="settings__section settings-business-form settings-panel__form">
                <input type="hidden" name="logo_url" value={business?.logo_url ?? ''} />
                <input type="hidden" name="favicon_url" value={faviconUrl} />
                <section className="settings-business-form__section">
                  <div className="settings-business-form__section-head">
                  </div>
                  <div className="settings-business-form__grid">
                    <label>
                      Business Name
                      <input name="name" type="text" required defaultValue={business?.name ?? ''} />
                    </label>
                    <label>
                      Domain
                      <input name="domain" type="text" defaultValue={business?.domain ?? ''} readOnly />
                    </label>
                    <label>
                      Email
                      <input name="email" type="email" defaultValue={business?.email ?? ''} />
                    </label>
                    <label>
                      Phone
                      <input name="phone" type="tel" defaultValue={business?.phone ? formatPhone(business.phone) : ''} />
                    </label>
                    <label>
                      Address Line 1
                      <input name="address_line1" type="text" defaultValue={business?.address_line1 ?? ''} />
                    </label>
                    <label>
                      Address Line 2
                      <input name="address_line2" type="text" defaultValue={business?.address_line2 ?? ''} />
                    </label>
                    <label>
                      City
                      <input name="city" type="text" defaultValue={business?.city ?? ''} />
                    </label>
                    <label>
                      State
                      <select name="state" defaultValue={(business?.state ?? '').toUpperCase()}>
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
                      <input name="zip" type="text" defaultValue={business?.zip ?? ''} />
                    </label>
                    <label>
                      Timezone
                      <select name="timezone" defaultValue={normalizeBusinessTimezone(business?.timezone)}>
                        {BUSINESS_TIMEZONE_OPTIONS.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label} ({value})
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </section>

                <section className="settings-business-form__section">
                  <div className="settings-business-form__section-head" />
                  <div className="settings-business-form__grid">
                    <label>
                      Send From Name
                      <input
                        name="email_from_name"
                        type="text"
                        defaultValue={emailFromName}
                        placeholder={business?.name ?? 'Your Business Name'}
                      />
                    </label>
                    <label>
                      Send From Address
                      <input
                        name="email_from_address"
                        type="email"
                        defaultValue={emailFromAddress}
                        placeholder={business?.email ?? 'hello@yourdomain.com'}
                      />
                    </label>
                    <label className="settings-business-form__field--wide">
                      Reply-To Email
                      <input
                        name="email_reply_to"
                        type="email"
                        defaultValue={emailReplyTo}
                        placeholder={business?.email ?? 'reply@yourdomain.com'}
                      />
                    </label>
                    <label>
                      Primary CTA Label
                      <input name="primary_cta_label" type="text" defaultValue={primaryCtaLabel} placeholder="Get a Quote" />
                    </label>
                    <label>
                      Secondary CTA Label
                      <input name="secondary_cta_label" type="text" defaultValue={secondaryCtaLabel} placeholder="Our Services" />
                    </label>
                    <label className="settings-business-form__field--wide">
                      Secondary CTA Link
                      <input name="secondary_cta_link" type="text" defaultValue={secondaryCtaLink} placeholder="/services" />
                    </label>
                    <label className="settings-business-form__field--wide">
                      Team Title Types
                      <textarea
                        name="team_title_types"
                        rows={3}
                        defaultValue={teamTitleTypes.join('\n')}
                        placeholder={'Project Manager\nTechnician\nEstimator'}
                      />
                    </label>
                  </div>
                </section>

                <section className="settings-business-form__section">
                  <div className="settings-business-form__section-head">
                    <span className="settings-panel__eyebrow">Licenses</span>
                    <p className="settings-panel__lede">Add one or more business license labels and numbers for use throughout the site and footer.</p>
                  </div>
                  <LicenseNumbersField initialValue={licenseNumbers} />
                </section>

                <div className="settings-business-form__actions">
                  <PendingSubmitButton idleLabel="Save Business Settings" />
                </div>
            </form>
            </div>
          </div>
        )}

        {activeTab === 'content' && (
          <div className="settings-tab-panel">
            <div className="settings__section settings-card settings-card--bare settings-card--templates settings-panel settings-panel--bare">
              <ContentDefaultsSettingsTable
                serviceDefaults={{
                  icon: serviceDefaultIcon,
                  metaTitle: serviceDefaultTitleTemplate,
                  metaDescription: serviceDefaultMetaDescriptionTemplate,
                  h1: serviceDefaultH1Template,
                  url: serviceDefaultUrlTemplate,
                  urlBase: serviceDetailBasePath,
                  showCardExcerpts: showServiceCardExcerpts,
                }}
                areaDefaults={{
                  icon: areaDefaultIcon,
                  metaTitle: AreaDefaultTitleTemplate,
                  metaDescription: areaDefaultMetaDescriptionTemplate,
                  h1: AreaDefaultH1Template,
                  url: AreaDefaultUrlTemplate,
                  urlBase: areaDetailBasePath,
                  showCardExcerpts: showAreaCardExcerpts,
                }}
              />
            </div>
          </div>
        )}

        {activeTab === 'header' && (
          <div className="settings-tab-panel">
            <div className="settings__section settings-card settings-panel">
              <div className="settings-panel__head">
                <span className="settings-panel__eyebrow">Navigation</span>
                <p className="settings-panel__lede">Control the main navigation structure, managed page links, and menu hierarchy.</p>
              </div>
              <form action={saveHeaderNavigationSettingsAction} className="settings__section settings__section--header-nav">
                <HeaderNavBuilderField
                  initialConfig={headerNavConfig}
                  serviceOptions={services.map((service) => ({
                    id: service.id,
                    title: service.title ?? service.slug ?? 'Untitled Service',
                    parent_service_id: service.parent_service_id ?? null,
                  }))}
                  pageOptions={pages.map((page) => ({
                    id: page.id,
                    page_kind: page.page_kind,
                    slug: page.slug,
                    title: page.title,
                  }))}
                />
                <PendingSubmitButton idleLabel="Save Header Navigation" />
              </form>
            </div>
          </div>
        )}

        {activeTab === 'footer' && (
          <div className="settings-tab-panel">
            <div className="settings__section settings-card settings-panel">
              <div className="settings-panel__head">
                <span className="settings-panel__eyebrow">Footer</span>
                <p className="settings-panel__lede">Build footer columns, mix text, links, and media, and control exactly what appears in each column.</p>
              </div>
              <form action={saveFooterBuilderSettingsAction} className="settings__section settings__section--header-nav">
                <input type="hidden" name="business_id" value={business?.id ?? ''} />
                <FooterBuilderField
                  initialConfig={footerBuilderConfig}
                  pageOptions={pages.map((page) => ({
                    id: page.id,
                    page_kind: page.page_kind,
                    slug: page.slug,
                    title: page.title,
                  }))}
                />
                <PendingSubmitButton idleLabel="Save Footer Builder" />
              </form>
            </div>
          </div>
        )}

        {activeTab === 'seo' && (
          <div className="settings-tab-panel">
            <div className="settings__section settings-card settings-card--seo settings-panel">
              <div className="settings-panel__head">
                <span className="settings-panel__eyebrow">Search</span>
                <p className="settings-panel__lede">Manage sitemap exclusions and search-facing content. Robots.txt and schema are generated automatically.</p>
              </div>
            <form action={saveSeoSettingsAction} className="settings__section settings-seo-grid">
          <input type="hidden" name="google_business_profile_url" value={seoSettings?.google_business_profile_url ?? ''} />
          <label className="settings-seo-grid__sitemap">
            Sitemap Excludes (comma or line separated)
            <textarea
              name="sitemap_excludes"
              rows={3}
              defaultValue={(seoSettings?.sitemap_excludes ?? []).join('\n')}
            />
          </label>
          <BusinessLogoField
            initialValue={seoSettings?.og_image_url ?? ''}
            label="Default Share Image"
            fieldName="og_image_url"
            mediaTab="graphics"
            uploadRole="generic"
          />
          <div className="settings-section__actions settings-seo-grid__actions">
            <PendingSubmitButton idleLabel="Save SEO Settings" />
          </div>
            </form>
            </div>

            <div className="settings__section settings-card settings-card--redirects settings-panel">
              <div className="settings-panel__head">
                <span className="settings-panel__eyebrow">Routing</span>
                <p className="settings-panel__lede">Create and maintain redirect rules without leaving Settings.</p>
              </div>
              <form action={saveRedirectAction} className="settings__section settings-redirects-form">
                <label className="settings-redirects-form__field settings-redirects-form__field--inline">
                  <span>From</span>
                  <input name="from_path" type="text" required placeholder="/old-path" />
                </label>
                <label className="settings-redirects-form__field settings-redirects-form__field--inline">
                  <span>To</span>
                  <input name="to_path" type="text" required placeholder="/new-path" />
                </label>
                <label className="settings-redirects-form__field settings-redirects-form__field--inline settings-field--quarter">
                  <span>Type</span>
                  <select name="type" defaultValue="301">
                    <option value="301">301 Permanent</option>
                    <option value="302">302 Temporary</option>
                  </select>
                </label>
                <label className="settings-redirects-form__field settings-redirects-form__field--checkbox settings-field--quarter">
                  <input name="is_active" type="checkbox" defaultChecked />
                  Active
                </label>
                <div className="settings-section__actions">
                  <button type="submit" className="btn">
                    Add Redirect
                  </button>
                </div>
              </form>

              {redirects.length === 0 ? (
                <p>No redirects yet.</p>
              ) : (
                redirects.map((redirect) => (
                  <form key={redirect.id} action={saveRedirectAction} className="settings__section settings-redirects-form settings-redirects-form--item">
                    <input type="hidden" name="id" value={redirect.id} />
                    <label className="settings-redirects-form__field settings-redirects-form__field--inline">
                      <span>From</span>
                      <input name="from_path" type="text" required defaultValue={redirect.from_path} />
                    </label>
                    <label className="settings-redirects-form__field settings-redirects-form__field--inline">
                      <span>To</span>
                      <input name="to_path" type="text" required defaultValue={redirect.to_path} />
                    </label>
                    <label className="settings-redirects-form__field settings-redirects-form__field--inline settings-field--quarter">
                      <span>Type</span>
                      <select name="type" defaultValue={redirect.type}>
                        <option value="301">301 Permanent</option>
                        <option value="302">302 Temporary</option>
                      </select>
                    </label>
                    <label className="settings-redirects-form__field settings-redirects-form__field--checkbox settings-field--quarter">
                      <input name="is_active" type="checkbox" defaultChecked={redirect.is_active} />
                      Active
                    </label>
                    <div className="settings-section__actions settings-section__actions--split">
                      <PendingSubmitButton idleLabel="Save" />
                      <button
                        type="submit"
                        className="btn"
                        formAction={async () => {
                          'use server';
                          await deleteRedirectAction(redirect.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </form>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="settings-tab-panel">
            <BusinessUsersManager
              businessId={dashboardProfile.business_id}
              users={managedUsers}
              title="Users"
              description="Invite admins and users for this site, adjust roles, or remove access."
            />
          </div>
        )}

        {activeTab === 'import' && (
          <div className="settings-tab-panel">
            <SettingsContentImportForm
              blogPostOptions={blogPosts.map((post) => ({ id: post.id, label: post.title || post.slug }))}
              pageOptions={pages.map((page) => ({ id: page.id, label: page.title || page.slug }))}
              serviceOptions={services.map((service) => ({ id: service.id, label: service.title || service.slug }))}
              AreaOptions={Areas.map((area) => ({ id: area.id, label: area.name || area.slug }))}
              testimonialOptions={testimonials.map((testimonial) => ({
                id: testimonial.id,
                label: testimonial.customer_name || testimonial.id,
              }))}
            />
          </div>
        )}

        {activeTab === 'google' && (
          <div className="settings-tab-panel">
            <div className="settings__section settings-card settings-panel">
              <div className="settings-card__head settings-panel__head settings-panel__head--split">
                <div className="settings-panel__title-group">
                  <span className="settings-panel__eyebrow">Google Business Profile</span>
                  <p className="settings-panel__lede">Manage analytics IDs, account IDs, review links, and Google Business Profile connection status.</p>
                </div>
                <span
                  className={`status-badge ${
                    googleBusinessProfileRefreshToken ? 'status-badge--success' : 'status-badge--neutral'
                  }`}
                >
                  {googleBusinessProfileRefreshToken ? 'GBP Connected' : 'GBP Not Connected'}
                </span>
              </div>
              <form
                action={async (formData) => {
                  'use server';
                  await saveBusinessSettingsAction(formData);
                  await saveSeoSettingsAction(formData);
                }}
                className="settings__section settings__section--three-col settings-panel__form settings-panel__form--flush"
              >
                <input type="hidden" name="name" value={business?.name ?? ''} />
                <input type="hidden" name="phone" value={business?.phone ?? ''} />
                <input type="hidden" name="email" value={business?.email ?? ''} />
                <input type="hidden" name="domain" value={business?.domain ?? ''} />
                <input type="hidden" name="logo_url" value={business?.logo_url ?? ''} />
                <input type="hidden" name="address_line1" value={business?.address_line1 ?? ''} />
                <input type="hidden" name="address_line2" value={business?.address_line2 ?? ''} />
                <input type="hidden" name="city" value={business?.city ?? ''} />
                <input type="hidden" name="state" value={business?.state ?? ''} />
                <input type="hidden" name="zip" value={business?.zip ?? ''} />
                <input type="hidden" name="timezone" value={business?.timezone ?? 'America/New_York'} />
                <input type="hidden" name="team_title_types" value={teamTitleTypes.join('\n')} />
                <input type="hidden" name="contact_form_id" value={contactFormId} />
                <input type="hidden" name="favicon_url" value={faviconUrl} />
                <input type="hidden" name="google_business_profile_refresh_token" value={googleBusinessProfileRefreshToken} />
                <input type="hidden" name="google_business_profile_url" value={seoSettings?.google_business_profile_url ?? ''} />
                <input type="hidden" name="sitemap_excludes" value={(seoSettings?.sitemap_excludes ?? []).join('\n')} />

                <label className="settings-field--half">
                  Google Analytics ID
                  <input
                    name="google_analytics_id"
                    type="text"
                    defaultValue={seoSettings?.google_analytics_id ?? ''}
                    placeholder="G-XXXXXXXXXX"
                  />
                </label>
                <label className="settings-field--half">
                  Google Tag Manager ID
                  <input
                    name="google_tag_manager_id"
                    type="text"
                    defaultValue={seoSettings?.google_tag_manager_id ?? ''}
                    placeholder="GTM-XXXXXXX"
                  />
                </label>
                <label className="settings-field--half">
                  Google Business Profile Account ID
                  <input
                    name="google_business_profile_account_id"
                    type="text"
                    defaultValue={googleBusinessProfileAccountId}
                    placeholder="123456789012345678901"
                  />
                </label>
                <label className="settings-field--half">
                  Google Business Profile Location ID
                  <input
                    name="google_business_profile_location_id"
                    type="text"
                    defaultValue={googleBusinessProfileLocationId}
                    placeholder="123456789012345678901"
                  />
                </label>
                {query.google === 'connected' && (
                  <p className="settings-panel__message" style={{ gridColumn: '1 / -1' }}>
                    {query.google_message || 'Google Business Profile connected successfully.'}
                  </p>
                )}
                {query.google === 'error' && (
                  <p className="form-error" style={{ gridColumn: '1 / -1' }}>{query.google_message || 'Google Business Profile connection failed'}</p>
                )}

                <div className="settings-panel__action-row" style={{ gridColumn: '1 / -1' }}>
                  <Link href="/api/integrations/google-business-profile/connect" className="btn btn--primary">
                    {googleBusinessProfileRefreshToken ? 'Reconnect Google Business Profile' : 'Connect Google Business Profile'}
                  </Link>
                  <PendingSubmitButton idleLabel="Save Google IDs" />
                </div>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'quickbooks' && (
          <div className="settings-tab-panel">
            <div className="settings__section settings-card settings-panel">
              <div className="settings-card__head settings-panel__head">
                <div className="settings-panel__title-group">
                  <span
                    className={`status-badge ${
                      quickBooksConnection ? 'status-badge--success' : 'status-badge--neutral'
                    }`}
                  >
                    {quickBooksConnection ? 'Connected' : 'Not Connected'}
                  </span>
                  <p className="settings-panel__lede">Manage your QuickBooks connection and products/services.</p>
                </div>
              </div>
              {query.quickbooks === 'connected' && (
                <p className="settings-panel__message">{query.message || 'QuickBooks connected and initial sync completed.'}</p>
              )}
            {query.quickbooks === 'error' && (
              <p className="form-error">{query.message || 'QuickBooks connection failed'}</p>
            )}
            {query.last_error && <p className="form-error">{query.last_error}</p>}
            {quickBooksConnection ? (
              <>
                <div className="settings__section settings-panel__status">
                  <p>
                    Connected to QuickBooks company:{' '}
                    <strong>{quickBooksConnection.company_name || quickBooksConnection.realm_id}</strong>
                  </p>
                  <p>
                    Realm ID: <code>{quickBooksConnection.realm_id}</code>
                  </p>
                  <p>
                    Last sync:{' '}
                    {quickBooksConnection.last_synced_at
                      ? formatDateTime(quickBooksConnection.last_synced_at)
                      : 'Never'}
                  </p>
                  {quickBooksConnection.last_sync_error && (
                    <p className="form-error">{quickBooksConnection.last_sync_error}</p>
                  )}
                  <div className="settings-panel__action-row">
                    <form
                      action={async () => {
                        'use server';
                        await runFullQuickBooksReconcileAction();
                      }}
                    >
                      <button type="submit" className="btn btn--secondary">Run Full Reconcile</button>
                    </form>
                    <form
                      action={async () => {
                        'use server';
                        await disconnectQuickBooksConnectionAction();
                      }}
                    >
                      <button type="submit" className="btn">Disconnect QuickBooks</button>
                    </form>
                  </div>
                </div>
                <div className="settings__section settings-card settings-panel">
                  <div className="settings-business-form__section-head">
                    <span className="settings-panel__eyebrow">Tax Defaults</span>
                    <p className="settings-panel__lede">Use one saved rate for new estimates and invoices.</p>
                  </div>
                  <form action={saveBusinessSettingsAction} className="settings__section settings-business-form settings-panel__form settings-panel__form--flush">
                    <BusinessSettingsHiddenInputs
                      business={business}
                      teamTitleTypes={teamTitleTypes}
                      contactFormId={contactFormId}
                      faviconUrl={faviconUrl}
                    />
                    <div className="settings-business-form__grid">
                      <label className="settings-field--half">
                        Default Tax Rate (%)
                        <input
                          name="default_tax_rate"
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={defaultTaxRate ?? ''}
                          placeholder="8.25"
                        />
                      </label>
                    </div>
                    <div className="settings-panel__action-row">
                      <PendingSubmitButton idleLabel="Save Tax Default" />
                    </div>
                  </form>
                </div>
                <QuickBooksItemsManager items={quickBooksItems} />
              </>
            ) : (
              <div className="settings__section settings-panel__status">
              <div className="settings-panel__action-row">
                <Link href="/api/integrations/quickbooks/connect" className="btn btn--primary">
                  Connect QuickBooks
                </Link>
              </div>
              </div>
            )}
            </div>
          </div>
        )}
      </div>
    </ModuleShell>
  );
}
