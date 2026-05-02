import { createClient } from '@/lib/supabase/server';
import { getCurrentDashboardBusinessId } from '@/lib/authz/dashboard';
import { resolveDashboardRange, type DashboardRangeKey } from '@/lib/dashboard/dateRanges';
import { getGoogleBusinessProfilePerformanceSummary } from '@/lib/integrations/googleBusinessProfile';
import { getMediaRoleFromMetadata } from '@/lib/media/roles';
import type { Tables } from '@/lib/types/database';

type ActivityLog = Tables<'activity_log'>;
type AnalyticsEvent = Tables<'analytics_events'>;
type Business = Tables<'businesses'>;
type DashboardStats = Tables<'dashboard_stats'>;
type NavigationMenu = Tables<'navigation_menus'>;
type QuickBooksConnection = Tables<'quickbooks_connections'>;
type Redirect = Tables<'redirects'>;
type SeoSettings = Tables<'seo_settings'>;
type UpcomingSchedule = Tables<'upcoming_schedule'>;
type BusinessDomain = Tables<'business_domains'>;

type AnalyticsEventSummary = Pick<
  AnalyticsEvent,
  'id' | 'event_type' | 'page_url' | 'referrer' | 'device_type' | 'session_id' | 'created_at'
>;

interface GoogleBusinessProfilePerformanceSummary {
  businessId: string;
  locationId: string;
  days: number;
  totals: {
    searchImpressions: number;
    mapsImpressions: number;
    websiteClicks: number;
    callClicks: number;
    directionRequests: number;
  };
  byDay: Array<{
    date: string;
    searchImpressions: number;
    mapsImpressions: number;
    websiteClicks: number;
    callClicks: number;
    directionRequests: number;
  }>;
}

function normalizeAnalyticsPageUrl(value: string | null | undefined) {
  const raw = (value ?? '').trim();
  if (!raw) return '(unknown)';

  const [withoutHash] = raw.split('#');
  const [pathname, query = ''] = withoutHash.split('?');
  const normalizedPath = pathname?.trim() || '/';
  if (!query) return normalizedPath;

  const params = new URLSearchParams(query);
  const kept = new URLSearchParams();
  for (const [key, paramValue] of params.entries()) {
    if (key.toLowerCase().startsWith('utm_')) continue;
    if (['fbclid', 'gclid', 'gbraid', 'wbraid', 'mc_cid', 'mc_eid', '_hsenc', '_hsmi'].includes(key.toLowerCase())) continue;
    kept.append(key, paramValue);
  }

  const nextQuery = kept.toString();
  return nextQuery ? `${normalizedPath}?${nextQuery}` : normalizedPath;
}

type Contact = Tables<'contacts'>;
type EmailLog = Tables<'email_log'>;
type Estimate = Tables<'estimates'>;
type Invoice = Tables<'invoices'>;
type Job = Tables<'jobs'>;
type JobTeamMember = Tables<'job_team_members'>;
type TeamMember = Tables<'team_members'>;
type TeamMemberEmployment = Tables<'team_member_employment'>;

interface DashboardChartPoint {
  label: string;
  value: number;
}

function isGoogleBusinessProfileNotConnectedError(message: string) {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return false;

  return [
    'refresh token is not configured',
    'account id is not configured',
    'location id is not configured',
    'business context is required',
    'unable to refresh google access token',
  ].some((needle) => normalized.includes(needle));
}

export async function getDashboardBusinessId() {
  return await getCurrentDashboardBusinessId();
}

export async function getDashboardOverviewData() {
  const businessId = await getDashboardBusinessId();
  if (!businessId) {
    return {
      stats: null as DashboardStats | null,
      upcomingJobs: [] as UpcomingSchedule[],
      recentActivity: [] as Array<Pick<ActivityLog, 'id' | 'action' | 'entity_type' | 'created_at'>>,
    };
  }

  const supabase = await createClient();
  const [{ data: stats, error: statsError }, { data: upcoming, error: upcomingError }, { data: activity, error: activityError }] =
    await Promise.all([
      supabase
        .from('dashboard_stats')
        .select('*')
        .eq('business_id', businessId)
        .maybeSingle(),
      supabase
        .from('upcoming_schedule')
        .select('*')
        .eq('business_id', businessId)
        .order('scheduled_start', { ascending: true, nullsFirst: false })
        .limit(8),
      supabase
        .from('activity_log')
        .select('id, action, entity_type, created_at')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

  if (statsError) throw new Error(statsError.message);
  if (upcomingError) throw new Error(upcomingError.message);
  if (activityError) throw new Error(activityError.message);

  return {
    stats: (stats ?? null) as DashboardStats | null,
    upcomingJobs: (upcoming ?? []) as UpcomingSchedule[],
    recentActivity: (activity ?? []) as Array<
      Pick<ActivityLog, 'id' | 'action' | 'entity_type' | 'created_at'>
    >,
  };
}

export async function getDashboardSettingsData() {
  const businessId = await getDashboardBusinessId();
  if (!businessId) {
    return {
      business: null as Business | null,
      seoSettings: null as SeoSettings | null,
      navigationMenus: [] as NavigationMenu[],
      quickBooksConnection: null as QuickBooksConnection | null,
      redirects: [] as Redirect[],
      domains: [] as BusinessDomain[],
    };
  }

  const supabase = await createClient();
  const [{ data: business, error: businessError }, { data: seo, error: seoError }, { data: menus, error: menusError }, { data: quickBooks, error: quickBooksError }, { data: redirects, error: redirectsError }, { data: mediaRows, error: mediaError }, { data: domains, error: domainsError }] =
    await Promise.all([
      supabase
        .from('businesses')
        .select('*')
        .eq('id', businessId)
        .maybeSingle(),
      supabase
        .from('seo_settings')
        .select('*')
        .eq('business_id', businessId)
        .maybeSingle(),
      supabase
        .from('navigation_menus')
        .select('*')
        .eq('business_id', businessId),
      supabase
        .from('quickbooks_connections')
        .select('*')
        .eq('business_id', businessId)
        .maybeSingle(),
      supabase
        .from('redirects')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false }),
      supabase
        .from('media')
        .select('file_url, metadata, created_at')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(120),
      supabase
        .from('business_domains')
        .select('*')
        .eq('business_id', businessId)
        .order('is_primary', { ascending: false })
        .order('domain', { ascending: true }),
    ]);

  if (businessError) throw new Error(businessError.message);
  if (seoError) throw new Error(seoError.message);
  if (menusError) throw new Error(menusError.message);
  if (quickBooksError) throw new Error(quickBooksError.message);
  if (redirectsError) throw new Error(redirectsError.message);
  if (mediaError) throw new Error(mediaError.message);
  if (domainsError) throw new Error(domainsError.message);

  const logoRow = (mediaRows ?? []).find((row) => getMediaRoleFromMetadata(row.metadata) === 'logo');
  const businessWithLogo = business
    ? ({
        ...business,
        logo_url: logoRow?.file_url ?? null,
      } as Business)
    : null;

  return {
    business: businessWithLogo,
    seoSettings: (seo ?? null) as SeoSettings | null,
    navigationMenus: (menus ?? []) as NavigationMenu[],
    quickBooksConnection: (quickBooks ?? null) as QuickBooksConnection | null,
    redirects: (redirects ?? []) as Redirect[],
    domains: (domains ?? []) as BusinessDomain[],
  };
}

export async function getDashboardBusinessSettings() {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return null;

  const supabase = await createClient();
  const { data: business, error } = await supabase
    .from('businesses')
    .select('settings')
    .eq('id', businessId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (!business?.settings || typeof business.settings !== 'object' || Array.isArray(business.settings)) {
    return null;
  }

  return business.settings as Record<string, unknown>;
}

export async function getDashboardAnalyticsData(rangeKey?: DashboardRangeKey) {
  const businessId = await getDashboardBusinessId();
  const range = resolveDashboardRange(rangeKey);
  if (!businessId) {
    return {
      range,
      totals: {
        pageViews: 0,
        uniqueSessions: 0,
        avgSessionLengthSeconds: 0,
        formSubmissions: 0,
        phoneClicks: 0,
        ctaClicks: 0,
        callRate: 0,
        conversionRate: 0,
      },
      topPages: [] as Array<{
        pageUrl: string;
        views: number;
        formSubmissions: number;
        phoneClicks: number;
        ctaClicks: number;
        conversionRate: number;
      }>,
      trafficSeries: [] as DashboardChartPoint[],
      referringSources: [] as Array<{ source: string; sessions: number }>,
      deviceBreakdown: [] as Array<{ deviceType: string; count: number }>,
      recentEvents: [] as AnalyticsEventSummary[],
      gbpPerformance: null as GoogleBusinessProfilePerformanceSummary | null,
      gbpPerformanceError: null as string | null,
    };
  }

  const supabase = await createClient();

  const [
    { data: eventsInRange, error: eventsInRangeError },
    { data: recentEvents, error: recentEventsError },
  ] = await Promise.all([
    supabase
      .from('analytics_events')
      .select('id, event_type, page_url, referrer, device_type, session_id, created_at')
      .eq('business_id', businessId)
      .gte('created_at', range.startIso)
      .lte('created_at', range.endIso)
      .order('created_at', { ascending: false })
      .limit(5000),
    supabase
      .from('analytics_events')
      .select('id, event_type, page_url, referrer, device_type, session_id, created_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  if (eventsInRangeError) throw new Error(eventsInRangeError.message);
  if (recentEventsError) throw new Error(recentEventsError.message);
  const allEvents = (eventsInRange ?? []) as AnalyticsEventSummary[];
  const pageViews = allEvents.filter((event) => event.event_type === 'page_view');
  const formSubmits = allEvents.filter((event) => event.event_type === 'form_submit');
  const phoneClicks = allEvents.filter((event) => event.event_type === 'phone_click');
  const ctaClicks = allEvents.filter((event) => event.event_type === 'cta_click');

  const pageCounts = new Map<string, number>();
  const pageFormCounts = new Map<string, number>();
  const pagePhoneCounts = new Map<string, number>();
  const pageCtaCounts = new Map<string, number>();
  const deviceCounts = new Map<string, number>();
  const referrerSessions = new Map<string, Set<string>>();
  const sessions = new Map<string, { min: number; max: number }>();

  for (const event of allEvents) {
    const eventTs = Date.parse(event.created_at);
    const sessionId = (event.session_id ?? '').trim();
    if (sessionId && Number.isFinite(eventTs)) {
      const current = sessions.get(sessionId);
      sessions.set(sessionId, current ? { min: Math.min(current.min, eventTs), max: Math.max(current.max, eventTs) } : { min: eventTs, max: eventTs });
    }
  }

  for (const event of pageViews) {
    const pageKey = normalizeAnalyticsPageUrl(event.page_url);
    pageCounts.set(pageKey, (pageCounts.get(pageKey) ?? 0) + 1);

    const deviceKey = (event.device_type ?? '').trim() || 'unknown';
    deviceCounts.set(deviceKey, (deviceCounts.get(deviceKey) ?? 0) + 1);

    const referrerKey = normalizeReferrer(event.referrer);
    const sessionId = (event.session_id ?? '').trim() || `event:${event.id}`;
    if (!referrerSessions.has(referrerKey)) referrerSessions.set(referrerKey, new Set());
    referrerSessions.get(referrerKey)?.add(sessionId);
  }

  for (const event of formSubmits) {
    const pageKey = normalizeAnalyticsPageUrl(event.page_url);
    pageFormCounts.set(pageKey, (pageFormCounts.get(pageKey) ?? 0) + 1);
  }

  for (const event of phoneClicks) {
    const pageKey = normalizeAnalyticsPageUrl(event.page_url);
    pagePhoneCounts.set(pageKey, (pagePhoneCounts.get(pageKey) ?? 0) + 1);
  }

  for (const event of ctaClicks) {
    const pageKey = normalizeAnalyticsPageUrl(event.page_url);
    pageCtaCounts.set(pageKey, (pageCtaCounts.get(pageKey) ?? 0) + 1);
  }

  const topPages = Array.from(pageCounts.entries())
    .map(([pageUrl, views]) => {
      const pageForms = pageFormCounts.get(pageUrl) ?? 0;
      const pagePhone = pagePhoneCounts.get(pageUrl) ?? 0;
      const pageCta = pageCtaCounts.get(pageUrl) ?? 0;
      return {
        pageUrl,
        views,
        formSubmissions: pageForms,
        phoneClicks: pagePhone,
        ctaClicks: pageCta,
        conversionRate: views > 0 ? Math.round((pageForms / views) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.views - a.views || a.pageUrl.localeCompare(b.pageUrl))
    .slice(0, 10);

  const referringSources = Array.from(referrerSessions.entries())
    .map(([source, sourceSessions]) => ({ source, sessions: sourceSessions.size }))
    .sort((a, b) => b.sessions - a.sessions || a.source.localeCompare(b.source))
    .slice(0, 10);

  const deviceBreakdown = Array.from(deviceCounts.entries())
    .map(([deviceType, count]) => ({ deviceType, count }))
    .sort((a, b) => b.count - a.count || a.deviceType.localeCompare(b.deviceType));

  const uniqueSessions = sessions.size;
  const avgSessionLengthSeconds =
    uniqueSessions > 0
      ? Math.round(
          Array.from(sessions.values()).reduce((sum, session) => sum + Math.max(0, session.max - session.min), 0) /
            uniqueSessions /
            1000,
        )
      : 0;
  const conversionRate = pageViews.length > 0 ? Math.round((formSubmits.length / pageViews.length) * 1000) / 10 : 0;
  const callRate = pageViews.length > 0 ? Math.round((phoneClicks.length / pageViews.length) * 1000) / 10 : 0;

  let gbpPerformance: GoogleBusinessProfilePerformanceSummary | null = null;
  let gbpPerformanceError: string | null = null;
  try {
    gbpPerformance = (await getGoogleBusinessProfilePerformanceSummary({
      businessId,
      days: Math.min(range.days, 90),
    })) as GoogleBusinessProfilePerformanceSummary;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load Google Business Profile performance.';
    gbpPerformanceError = isGoogleBusinessProfileNotConnectedError(message)
      ? 'Google Business Profile is not configured for this business yet.'
      : message;
  }

  return {
    range,
    totals: {
      pageViews: pageViews.length,
      uniqueSessions,
      avgSessionLengthSeconds,
      formSubmissions: formSubmits.length,
      phoneClicks: phoneClicks.length,
      ctaClicks: ctaClicks.length,
      callRate,
      conversionRate,
    },
    topPages,
    trafficSeries: buildDashboardChartSeries({
      range,
      items: pageViews,
      getTimestamp: (event) => event.created_at,
    }),
    referringSources,
    deviceBreakdown,
    recentEvents: (recentEvents ?? []) as AnalyticsEventSummary[],
    gbpPerformance,
    gbpPerformanceError,
  };
}

function normalizeReferrer(value: string | null | undefined) {
  const raw = (value ?? '').trim();
  if (!raw) return 'Direct';

  try {
    const url = new URL(raw);
    return url.hostname.replace(/^www\./, '') || 'Direct';
  } catch {
    return raw;
  }
}

export async function getOperationsDashboardData(rangeKey?: DashboardRangeKey) {
  const businessId = await getDashboardBusinessId();
  const range = resolveDashboardRange(rangeKey);

  if (!businessId) {
    return {
      range,
      jobs: { scheduled: 0, inProgress: 0, completed: 0, canceled: 0, total: 0 },
      revenue: { total: 0 },
      invoices: { sent: 0, due: 0, overdue: 0, paid: 0, total: 0, totalAmount: 0, paidAmount: 0 },
      estimates: { sent: 0, approved: 0, rejected: 0, total: 0, totalAmount: 0 },
      revenueSeries: [] as DashboardChartPoint[],
      employees: [] as Array<{
        id: string;
        name: string;
        title: string | null;
        payType: string | null;
        rateLabel: string;
        hours: number;
        jobs: number;
        completedJobs: number;
      }>,
      recentActivity: [] as Array<Pick<ActivityLog, 'id' | 'action' | 'entity_type' | 'created_at'>>,
      contacts: { leads: 0, prospects: 0, customers: 0, prospectValue: 0, customerValue: 0 },
      communication: { emailsSent: 0, delivered: 0, opened: 0, clicked: 0 },
    };
  }

  const supabase = await createClient();
  const [
    { data: jobs, error: jobsError },
    { data: invoices, error: invoicesError },
    { data: estimates, error: estimatesError },
    { data: contacts, error: contactsError },
    { data: emails, error: emailsError },
    { data: teamMembers, error: teamMembersError },
    { data: teamEmployment, error: teamEmploymentError },
    { data: jobAssignments, error: jobAssignmentsError },
    { data: recentActivity, error: recentActivityError },
  ] = await Promise.all([
    supabase
      .from('jobs')
      .select('id, status, created_at, scheduled_start')
      .eq('business_id', businessId)
      .gte('created_at', range.startIso)
      .lte('created_at', range.endIso),
    supabase
      .from('invoices')
      .select('id, status, total, amount_paid, created_at, due_date')
      .eq('business_id', businessId)
      .gte('created_at', range.startIso)
      .lte('created_at', range.endIso),
    supabase
      .from('estimates')
      .select('id, status, total, created_at')
      .eq('business_id', businessId)
      .gte('created_at', range.startIso)
      .lte('created_at', range.endIso),
    supabase
      .from('contacts')
      .select('id, status, lifetime_value, created_at')
      .eq('business_id', businessId)
      .gte('created_at', range.startIso)
      .lte('created_at', range.endIso),
    supabase
      .from('email_log')
      .select('id, status, created_at')
      .eq('business_id', businessId)
      .gte('created_at', range.startIso)
      .lte('created_at', range.endIso),
    supabase
      .from('team_members')
      .select('id, first_name, last_name, title')
      .eq('business_id', businessId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('team_member_employment')
      .select('team_member_id, pay_type, hourly_rate, salary_amount')
      .eq('business_id', businessId),
    supabase
      .from('job_team_members')
      .select('team_member_id, hours_worked, jobs(id, status, created_at, scheduled_start)')
      .eq('business_id', businessId),
    supabase
      .from('activity_log')
      .select('id, action, entity_type, created_at')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  if (jobsError) throw new Error(jobsError.message);
  if (invoicesError) throw new Error(invoicesError.message);
  if (estimatesError) throw new Error(estimatesError.message);
  if (contactsError) throw new Error(contactsError.message);
  if (emailsError) throw new Error(emailsError.message);
  if (teamMembersError) throw new Error(teamMembersError.message);
  if (teamEmploymentError) throw new Error(teamEmploymentError.message);
  if (jobAssignmentsError) throw new Error(jobAssignmentsError.message);
  if (recentActivityError) throw new Error(recentActivityError.message);

  const now = new Date();
  const jobsInRange = ((jobs ?? []) as Array<Pick<Job, 'id' | 'status' | 'created_at' | 'scheduled_start'>>).filter((job) =>
    isTimestampInRange(job.scheduled_start ?? job.created_at, range.startIso, range.endIso),
  );
  const invoicesInRange = (invoices ?? []) as Array<Pick<Invoice, 'id' | 'status' | 'total' | 'amount_paid' | 'created_at' | 'due_date'>>;
  const estimatesInRange = (estimates ?? []) as Array<Pick<Estimate, 'id' | 'status' | 'total' | 'created_at'>>;
  const contactsInRange = (contacts ?? []) as Array<Pick<Contact, 'id' | 'status' | 'lifetime_value' | 'created_at'>>;
  const emailsInRange = (emails ?? []) as Array<Pick<EmailLog, 'id' | 'status' | 'created_at'>>;

  const employeeStats = new Map<string, { hours: number; jobs: Set<string>; completedJobs: number }>();
  for (const assignment of (jobAssignments ?? []) as Array<
    Pick<JobTeamMember, 'team_member_id' | 'hours_worked'> & {
      jobs: Pick<Job, 'id' | 'status' | 'created_at' | 'scheduled_start'> | null;
    }
  >) {
    const teamMemberId = assignment.team_member_id;
    const relatedJob = assignment.jobs;
    if (!teamMemberId || !relatedJob) continue;
    if (!isTimestampInRange(relatedJob.scheduled_start ?? relatedJob.created_at, range.startIso, range.endIso)) continue;

    const current = employeeStats.get(teamMemberId) ?? { hours: 0, jobs: new Set<string>(), completedJobs: 0 };
    current.hours += Number(assignment.hours_worked ?? 0);
    current.jobs.add(relatedJob.id);
    if (relatedJob.status === 'completed') current.completedJobs += 1;
    employeeStats.set(teamMemberId, current);
  }

  const employmentByMember = new Map(
    ((teamEmployment ?? []) as Array<Pick<TeamMemberEmployment, 'team_member_id' | 'pay_type' | 'hourly_rate' | 'salary_amount'>>).map((row) => [
      row.team_member_id,
      row,
    ]),
  );

  return {
    range,
    jobs: {
      scheduled: jobsInRange.filter((job) => job.status === 'scheduled').length,
      inProgress: jobsInRange.filter((job) => job.status === 'in_progress').length,
      completed: jobsInRange.filter((job) => job.status === 'completed').length,
      canceled: jobsInRange.filter((job) => job.status === 'canceled').length,
      total: jobsInRange.length,
    },
    revenue: {
      total: invoicesInRange.reduce((sum, invoice) => sum + Number(invoice.amount_paid ?? 0), 0),
    },
    invoices: {
      sent: invoicesInRange.filter((invoice) => invoice.status === 'sent' || invoice.status === 'viewed').length,
      due: invoicesInRange.filter((invoice) => invoice.status === 'draft' || invoice.status === 'sent' || invoice.status === 'viewed').length,
      overdue: invoicesInRange.filter((invoice) => invoice.status === 'overdue').length,
      paid: invoicesInRange.filter((invoice) => invoice.status === 'paid').length,
      total: invoicesInRange.length,
      totalAmount: invoicesInRange.reduce((sum, invoice) => sum + Number(invoice.total ?? 0), 0),
      paidAmount: invoicesInRange.reduce((sum, invoice) => sum + Number(invoice.amount_paid ?? 0), 0),
    },
    estimates: {
      sent: estimatesInRange.filter((estimate) => estimate.status === 'sent' || estimate.status === 'viewed').length,
      approved: estimatesInRange.filter((estimate) => estimate.status === 'approved').length,
      rejected: estimatesInRange.filter((estimate) => estimate.status === 'declined' || estimate.status === 'expired').length,
      total: estimatesInRange.length,
      totalAmount: estimatesInRange.reduce((sum, estimate) => sum + Number(estimate.total ?? 0), 0),
    },
    revenueSeries: buildDashboardChartSeries({
      range,
      items: invoicesInRange,
      getTimestamp: (invoice) => invoice.created_at,
      getValue: (invoice) => Number(invoice.amount_paid ?? 0),
    }),
    employees: ((teamMembers ?? []) as Array<Pick<TeamMember, 'id' | 'first_name' | 'last_name' | 'title'>>).map((member) => {
      const employment = employmentByMember.get(member.id);
      const stats = employeeStats.get(member.id);
      return {
        id: member.id,
        name: [member.first_name, member.last_name].filter(Boolean).join(' ').trim() || 'Unnamed team member',
        title: member.title ?? null,
        payType: employment?.pay_type ?? null,
        rateLabel:
          employment?.pay_type === 'salary'
            ? formatCurrencyNumber(employment.salary_amount)
            : employment?.pay_type === 'hourly'
              ? `${formatCurrencyNumber(employment.hourly_rate)}/hr`
              : employment?.pay_type === 'contract'
                ? formatCurrencyNumber(employment.hourly_rate ?? employment.salary_amount)
                : '-',
        hours: Math.round((stats?.hours ?? 0) * 100) / 100,
        jobs: stats?.jobs.size ?? 0,
        completedJobs: stats?.completedJobs ?? 0,
      };
    }),
    recentActivity: (recentActivity ?? []) as Array<
      Pick<ActivityLog, 'id' | 'action' | 'entity_type' | 'created_at'>
    >,
    contacts: {
      leads: contactsInRange.filter((contact) => contact.status === 'lead').length,
      prospects: contactsInRange.filter((contact) => contact.status === 'prospect').length,
      customers: contactsInRange.filter((contact) => contact.status === 'customer').length,
      prospectValue: contactsInRange
        .filter((contact) => contact.status === 'prospect')
        .reduce((sum, contact) => sum + Number(contact.lifetime_value ?? 0), 0),
      customerValue: contactsInRange
        .filter((contact) => contact.status === 'customer')
        .reduce((sum, contact) => sum + Number(contact.lifetime_value ?? 0), 0),
    },
    communication: {
      emailsSent: emailsInRange.filter((email) => ['queued', 'sent', 'delivered', 'opened', 'clicked'].includes(email.status)).length,
      delivered: emailsInRange.filter((email) => email.status === 'delivered').length,
      opened: emailsInRange.filter((email) => email.status === 'opened').length,
      clicked: emailsInRange.filter((email) => email.status === 'clicked').length,
    },
  };
}

function isTimestampInRange(value: string | null | undefined, startIso: string, endIso: string) {
  if (!value) return false;
  const ts = Date.parse(value);
  return Number.isFinite(ts) && ts >= Date.parse(startIso) && ts <= Date.parse(endIso);
}

function formatCurrencyNumber(value: number | null | undefined) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}

function buildDashboardChartSeries<T>({
  range,
  items,
  getTimestamp,
  getValue,
}: {
  range: ReturnType<typeof resolveDashboardRange>;
  items: T[];
  getTimestamp: (item: T) => string | null | undefined;
  getValue?: (item: T) => number;
}) {
  if (range.days > 31) {
    return buildMonthlySeries({ range, items, getTimestamp, getValue });
  }

  return buildDailySeries({ range, items, getTimestamp, getValue });
}

function buildDailySeries<T>({
  range,
  items,
  getTimestamp,
  getValue,
}: {
  range: ReturnType<typeof resolveDashboardRange>;
  items: T[];
  getTimestamp: (item: T) => string | null | undefined;
  getValue?: (item: T) => number;
}) {
  const start = new Date(range.startIso);
  start.setHours(0, 0, 0, 0);

  const buckets = Array.from({ length: range.days }, (_, index) => {
    const bucketDate = new Date(start);
    bucketDate.setDate(start.getDate() + index);
    return {
      label: bucketDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      start: bucketDate.getTime(),
      end: new Date(bucketDate.getFullYear(), bucketDate.getMonth(), bucketDate.getDate(), 23, 59, 59, 999).getTime(),
      value: 0,
    };
  });

  for (const item of items) {
    const timestamp = Date.parse(getTimestamp(item) ?? '');
    if (!Number.isFinite(timestamp)) continue;

    const bucket = buckets.find((entry) => timestamp >= entry.start && timestamp <= entry.end);
    if (!bucket) continue;
    bucket.value += Math.max(0, getValue ? getValue(item) : 1);
  }

  return buckets.map(({ label, value }) => ({ label, value: Math.round(value) }));
}

function buildMonthlySeries<T>({
  range,
  items,
  getTimestamp,
  getValue,
}: {
  range: ReturnType<typeof resolveDashboardRange>;
  items: T[];
  getTimestamp: (item: T) => string | null | undefined;
  getValue?: (item: T) => number;
}) {
  const start = new Date(range.startIso);
  const end = new Date(range.endIso);
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const buckets: Array<{ label: string; key: string; value: number }> = [];

  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
    buckets.push({
      key,
      label: cursor.toLocaleDateString('en-US', { month: 'short' }),
      value: 0,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const item of items) {
    const timestamp = new Date(getTimestamp(item) ?? '');
    if (Number.isNaN(timestamp.getTime())) continue;
    const key = `${timestamp.getFullYear()}-${timestamp.getMonth()}`;
    const bucket = bucketMap.get(key);
    if (!bucket) continue;
    bucket.value += Math.max(0, getValue ? getValue(item) : 1);
  }

  return buckets.map(({ label, value }) => ({ label, value: Math.round(value) }));
}
