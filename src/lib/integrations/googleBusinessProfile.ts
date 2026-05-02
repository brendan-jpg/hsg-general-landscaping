import { createAdminClient } from '@/lib/supabase/admin';
import type { TablesInsert, TablesUpdate } from '@/lib/types/database';

interface GoogleReviewer {
  displayName?: string;
  profilePhotoUrl?: string;
}

interface GoogleReview {
  name?: string;
  reviewId?: string;
  starRating?: string | number;
  comment?: string;
  createTime?: string;
  updateTime?: string;
  reviewer?: GoogleReviewer;
}

interface GoogleReviewsListResponse {
  reviews?: GoogleReview[];
  nextPageToken?: string;
}

interface GoogleReviewReply {
  comment?: string;
  updateTime?: string;
}

interface GoogleReviewReplyResponse {
  reviewReply?: GoogleReviewReply;
}

interface GoogleLocalPostCallToAction {
  actionType?: string;
  url?: string;
}

interface GoogleLocalPost {
  name?: string;
  languageCode?: string;
  summary?: string;
  topicType?: string;
  searchUrl?: string;
  state?: string;
  createTime?: string;
  updateTime?: string;
  callToAction?: GoogleLocalPostCallToAction;
}

interface GoogleLocalPostsListResponse {
  localPosts?: GoogleLocalPost[];
  nextPageToken?: string;
}

interface GoogleBusinessProfileSyncConfig {
  businessId: string;
  accountId: string;
  locationId: string;
  refreshToken: string;
}

interface GoogleOAuthTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

interface GoogleBusinessAccount {
  name?: string;
  accountName?: string;
  type?: string;
}

interface GoogleBusinessAccountsResponse {
  accounts?: GoogleBusinessAccount[];
}

interface GoogleBusinessLocation {
  name?: string;
  title?: string;
}

interface GoogleBusinessLocationsResponse {
  locations?: GoogleBusinessLocation[];
}

interface GoogleBusinessProfileConnectionSelection {
  accountId: string;
  locationId: string;
  accountName?: string | null;
  locationTitle?: string | null;
}

interface GoogleBusinessProfileConnectionContext {
  config: GoogleBusinessProfileSyncConfig;
  accessToken: string;
}

interface GoogleDateParts {
  year?: number;
  month?: number;
  day?: number;
}

interface GoogleBusinessProfileMetricPoint {
  date?: GoogleDateParts;
  value?: string | number;
}

interface GoogleBusinessProfileMetricSeries {
  dailyMetric?: string;
  timeSeries?: {
    datedValues?: GoogleBusinessProfileMetricPoint[];
  };
}

interface GoogleBusinessProfileMultiDailyMetricSeries {
  dailyMetricTimeSeries?: GoogleBusinessProfileMetricSeries[];
}

interface GoogleBusinessProfilePerformanceResponse {
  multiDailyMetricTimeSeries?: GoogleBusinessProfileMultiDailyMetricSeries[];
  error?: { message?: string };
}

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function getOptionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || null;
}

function readSettingsString(settings: unknown, key: string) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return '';
  const value = (settings as Record<string, unknown>)[key];
  return typeof value === 'string' ? value.trim() : '';
}

function extractAccountId(value: string | null | undefined) {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  const matched = raw.match(/accounts\/([^/]+)/i);
  return (matched?.[1] ?? raw).trim();
}

function extractLocationId(value: string | null | undefined) {
  const raw = (value ?? '').trim();
  if (!raw) return '';
  const matched = raw.match(/locations\/([^/]+)/i);
  return (matched?.[1] ?? raw).trim();
}

function normalizeGoogleReviewResourceName(value: string, accountId: string, locationId: string) {
  const raw = value.trim().replace(/^google-review:/i, '');
  if (!raw) return '';

  const fullNameMatch = raw.match(/accounts\/[^/]+\/locations\/[^/]+\/reviews\/[^/]+/i);
  if (fullNameMatch?.[0]) {
    return fullNameMatch[0].replace(/^\/+/, '');
  }

  const reviewId = raw.split('/').filter(Boolean).pop()?.trim() ?? '';
  if (!reviewId) return '';

  return `accounts/${extractAccountId(accountId)}/locations/${extractLocationId(locationId)}/reviews/${reviewId}`;
}

function toGoogleDateParts(value: Date): GoogleDateParts {
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    day: value.getUTCDate(),
  };
}

function toIsoDateFromParts(value?: GoogleDateParts) {
  if (!value?.year || !value?.month || !value?.day) return '';
  const yyyy = String(value.year).padStart(4, '0');
  const mm = String(value.month).padStart(2, '0');
  const dd = String(value.day).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function toMetricValue(value: string | number | undefined) {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function resolveGoogleBusinessProfileSyncConfig(
  explicitBusinessId?: string,
): Promise<GoogleBusinessProfileSyncConfig> {
  const businessId = explicitBusinessId?.trim() || getOptionalEnv('GOOGLE_BUSINESS_PROFILE_BUSINESS_ID') || '';
  if (!businessId) {
    throw new Error(
      'Business context is required. Provide a business_id or set GOOGLE_BUSINESS_PROFILE_BUSINESS_ID.'
    );
  }

  const supabase = createAdminClient();
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('id, settings')
    .eq('id', businessId)
    .maybeSingle();
  if (businessError) throw new Error(businessError.message);
  if (!business) throw new Error(`Business not found for id ${businessId}`);

  let accountId =
    extractAccountId(readSettingsString(business.settings, 'google_business_profile_account_id')) ||
    extractAccountId(getOptionalEnv('GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID')) ||
    '';
  let locationId =
    extractLocationId(readSettingsString(business.settings, 'google_business_profile_location_id')) ||
    extractLocationId(getOptionalEnv('GOOGLE_BUSINESS_PROFILE_LOCATION_ID')) ||
    '';
  const refreshToken =
    readSettingsString(business.settings, 'google_business_profile_refresh_token') ||
    getOptionalEnv('GOOGLE_BUSINESS_PROFILE_REFRESH_TOKEN') ||
    '';

  if (!refreshToken) {
    throw new Error(
      'Google Business Profile refresh token is not configured. Set business.settings.google_business_profile_refresh_token or GOOGLE_BUSINESS_PROFILE_REFRESH_TOKEN.'
    );
  }

  if (!accountId || !locationId) {
    try {
      const accessToken = await getAccessToken(refreshToken);
      const discovered = await discoverGoogleBusinessProfileConnection(accessToken);

      accountId = accountId || discovered.accountId;
      locationId = locationId || discovered.locationId;

      await saveGoogleBusinessProfileSettingsForBusiness({
        businessId,
        refreshToken,
        accountId,
        locationId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown discovery error';
      if (!accountId) {
        throw new Error(
          `Google Business Profile account id is not configured and auto-discovery failed: ${message}`
        );
      }
      if (!locationId) {
        throw new Error(
          `Google Business Profile location id is not configured and auto-discovery failed: ${message}`
        );
      }
    }
  }

  if (!accountId) {
    throw new Error(
      'Google Business Profile account id is not configured. Set business.settings.google_business_profile_account_id or GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID.'
    );
  }
  if (!locationId) {
    throw new Error(
      'Google Business Profile location id is not configured. Set business.settings.google_business_profile_location_id or GOOGLE_BUSINESS_PROFILE_LOCATION_ID.'
    );
  }

  return {
    businessId,
    accountId,
    locationId,
    refreshToken,
  };
}

async function resolveGoogleBusinessProfileConnectionContext(
  explicitBusinessId?: string,
): Promise<GoogleBusinessProfileConnectionContext> {
  const config = await resolveGoogleBusinessProfileSyncConfig(explicitBusinessId);
  const accessToken = await getAccessToken(config.refreshToken);
  return { config, accessToken };
}

function getGoogleOAuthRedirectUri() {
  return getRequiredEnv('GOOGLE_BUSINESS_PROFILE_REDIRECT_URI');
}

export function buildGoogleBusinessProfileAuthorizeUrl(state: string) {
  const clientId = getRequiredEnv('GOOGLE_BUSINESS_PROFILE_CLIENT_ID');
  const redirectUri = getGoogleOAuthRedirectUri();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/business.manage');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeGoogleBusinessProfileAuthorizationCode(code: string) {
  const clientId = getRequiredEnv('GOOGLE_BUSINESS_PROFILE_CLIENT_ID');
  const clientSecret = getRequiredEnv('GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET');
  const redirectUri = getGoogleOAuthRedirectUri();

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });

  const payload = (await response.json()) as GoogleOAuthTokenResponse;
  if (!response.ok) {
    throw new Error(payload.error_description || payload.error || 'Google OAuth token exchange failed');
  }
  if (!payload.access_token) throw new Error('Google access token missing in token response');
  if (!payload.refresh_token) {
    throw new Error('Google refresh token missing in token response. Re-consent with prompt=consent.');
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: payload.expires_in ?? null,
    tokenType: payload.token_type ?? null,
    scope: payload.scope ?? null,
  };
}

async function fetchGoogleBusinessAccounts(accessToken: string) {
  const response = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Unable to fetch Google Business accounts: ${message}`);
  }

  const payload = (await response.json()) as GoogleBusinessAccountsResponse;
  return payload.accounts ?? [];
}

async function fetchGoogleBusinessLocationsForAccount(accessToken: string, accountName: string) {
  const path = accountName.replace(/^\/+/, '');
  const url = new URL(`https://mybusinessbusinessinformation.googleapis.com/v1/${path}/locations`);
  url.searchParams.set('pageSize', '100');
  url.searchParams.set('readMask', 'name,title');

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Unable to fetch Google Business locations: ${message}`);
  }

  const payload = (await response.json()) as GoogleBusinessLocationsResponse;
  return payload.locations ?? [];
}

export async function discoverGoogleBusinessProfileConnection(accessToken: string): Promise<GoogleBusinessProfileConnectionSelection> {
  const accounts = await fetchGoogleBusinessAccounts(accessToken);
  if (accounts.length === 0) {
    throw new Error('No Google Business Profile accounts found for this user.');
  }

  for (const account of accounts) {
    const accountName = (account.name ?? '').trim();
    if (!accountName) continue;

    try {
      const locations = await fetchGoogleBusinessLocationsForAccount(accessToken, accountName);
      const firstLocation = locations.find((location) => Boolean((location.name ?? '').trim()));
      if (!firstLocation?.name) continue;

      const accountId = extractAccountId(accountName);
      const locationId = extractLocationId(firstLocation.name);
      if (!accountId || !locationId) continue;

      return {
        accountId,
        locationId,
        accountName: account.accountName ?? null,
        locationTitle: firstLocation.title ?? null,
      };
    } catch {
      continue;
    }
  }

  throw new Error('No Google Business Profile locations were accessible for the authorized user.');
}

export async function saveGoogleBusinessProfileSettingsForBusiness(options: {
  businessId: string;
  accountId?: string | null;
  locationId?: string | null;
  refreshToken: string;
}) {
  const supabase = createAdminClient();
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('settings')
    .eq('id', options.businessId)
    .maybeSingle();
  if (businessError) throw new Error(businessError.message);
  if (!business) throw new Error('Business not found');

  const base =
    business.settings && typeof business.settings === 'object' && !Array.isArray(business.settings)
      ? ({ ...(business.settings as Record<string, unknown>) } as Record<string, unknown>)
      : {};

  base.google_business_profile_refresh_token = options.refreshToken;
  if (options.accountId) base.google_business_profile_account_id = extractAccountId(options.accountId);
  if (options.locationId) base.google_business_profile_location_id = extractLocationId(options.locationId);

  const { error: updateError } = await supabase
    .from('businesses')
    .update({
      settings: base as never,
    })
    .eq('id', options.businessId);
  if (updateError) throw new Error(updateError.message);
}

function toRating(value: GoogleReview['starRating']) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return Math.max(1, Math.min(5, Math.round(value)));
  }

  const normalized = String(value ?? '').toUpperCase();
  const byEnum: Record<string, number> = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
    STAR_RATING_ONE: 1,
    STAR_RATING_TWO: 2,
    STAR_RATING_THREE: 3,
    STAR_RATING_FOUR: 4,
    STAR_RATING_FIVE: 5,
  };

  return byEnum[normalized] ?? null;
}

async function getAccessToken(refreshToken: string) {
  const clientId = getRequiredEnv('GOOGLE_BUSINESS_PROFILE_CLIENT_ID');
  const clientSecret = getRequiredEnv('GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET');

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    cache: 'no-store',
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Unable to refresh Google access token: ${message}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('Google access token missing in token response');
  return data.access_token;
}

async function fetchGoogleReviews(accessToken: string, accountId: string, locationId: string) {
  const reviews: GoogleReview[] = [];
  let pageToken: string | null = null;
  let pages = 0;

  do {
    const url = new URL(
      `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews`
    );
    url.searchParams.set('pageSize', '50');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Unable to fetch Google reviews: ${message}`);
    }

    const payload = (await response.json()) as GoogleReviewsListResponse;
    reviews.push(...(payload.reviews ?? []));
    pageToken = payload.nextPageToken ?? null;
    pages += 1;
  } while (pageToken && pages < 10);

  return reviews;
}

export async function syncGoogleBusinessProfileReviews(options?: { businessId?: string }) {
  const config = await resolveGoogleBusinessProfileSyncConfig(options?.businessId);
  const accessToken = await getAccessToken(config.refreshToken);
  const reviews = await fetchGoogleReviews(accessToken, config.accountId, config.locationId);
  const supabase = createAdminClient();

  const { data: existingRows, error: existingError } = await supabase
    .from('testimonials')
    .select('id, source_url, is_featured, service_id')
    .eq('business_id', config.businessId)
    .eq('source', 'google');
  if (existingError) throw new Error(existingError.message);

  const existing = existingRows ?? [];
  const existingBySourceUrl = new Map(
    existing
      .filter((row) => row.source_url)
      .map((row) => [row.source_url as string, row])
  );

  const seenSourceUrls = new Set<string>();
  const inserts: TablesInsert<'testimonials'>[] = [];
  const updates: Array<{ id: string; values: TablesUpdate<'testimonials'> }> = [];

  for (const review of reviews) {
    const content = (review.comment ?? '').trim();
    if (!content) continue;

    const sourceId = (review.reviewId ?? review.name ?? '').trim();
    if (!sourceId) continue;

    const sourceUrl = `google-review:${sourceId}`;
    seenSourceUrls.add(sourceUrl);

    const values: TablesUpdate<'testimonials'> = {
      customer_name: (review.reviewer?.displayName ?? 'Google Customer').trim() || 'Google Customer',
      area_id: null,
      content,
      rating: toRating(review.starRating),
      source: 'google',
      source_url: sourceUrl,
      avatar_url: review.reviewer?.profilePhotoUrl ?? null,
      review_date: review.createTime ?? null,
      is_active: true,
    };

    const existingRow = existingBySourceUrl.get(sourceUrl);
    if (existingRow) {
      updates.push({
        id: existingRow.id,
        values,
      });
      continue;
    }

    inserts.push({
      business_id: config.businessId,
      customer_name: values.customer_name ?? 'Google Customer',
      area_id: null,
      content,
      rating: values.rating ?? null,
      source: 'google',
      source_url: sourceUrl,
      avatar_url: values.avatar_url ?? null,
      review_date: values.review_date ?? null,
      is_featured: false,
      is_active: true,
      service_id: null,
    });
  }

  for (const update of updates) {
    const { error } = await supabase
      .from('testimonials')
      .update(update.values)
      .eq('id', update.id)
      .eq('business_id', config.businessId);
    if (error) throw new Error(error.message);
  }

  if (inserts.length > 0) {
    const { error } = await supabase.from('testimonials').insert(inserts);
    if (error) throw new Error(error.message);
  }

  const staleIds = existing
    .filter((row) => row.source_url && !seenSourceUrls.has(row.source_url))
    .map((row) => row.id);

  if (staleIds.length > 0) {
    const { error } = await supabase
      .from('testimonials')
      .update({ is_active: false })
      .in('id', staleIds)
      .eq('business_id', config.businessId);
    if (error) throw new Error(error.message);
  }

  return {
    businessId: config.businessId,
    fetched: reviews.length,
    inserted: inserts.length,
    updated: updates.length,
    deactivated: staleIds.length,
  };
}

export async function upsertGoogleBusinessProfileReviewReply(options: {
  businessId?: string;
  review: string;
  comment: string;
}) {
  const reviewInput = options.review.trim();
  const comment = options.comment.trim();
  if (!reviewInput) throw new Error('Review reference is required.');
  if (!comment) throw new Error('Review reply comment is required.');

  const { config, accessToken } = await resolveGoogleBusinessProfileConnectionContext(options.businessId);
  const reviewName = normalizeGoogleReviewResourceName(reviewInput, config.accountId, config.locationId);
  if (!reviewName) throw new Error('Invalid review reference.');

  const response = await fetch(`https://mybusiness.googleapis.com/v4/${encodeURI(reviewName)}/reply`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ comment }),
    cache: 'no-store',
  });

  const payload = (await response.json()) as GoogleReviewReplyResponse & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(payload.error?.message || 'Unable to save Google review reply.');
  }

  return {
    reviewName,
    comment: payload.reviewReply?.comment ?? comment,
    updateTime: payload.reviewReply?.updateTime ?? null,
  };
}

export async function deleteGoogleBusinessProfileReviewReply(options: {
  businessId?: string;
  review: string;
}) {
  const reviewInput = options.review.trim();
  if (!reviewInput) throw new Error('Review reference is required.');

  const { config, accessToken } = await resolveGoogleBusinessProfileConnectionContext(options.businessId);
  const reviewName = normalizeGoogleReviewResourceName(reviewInput, config.accountId, config.locationId);
  if (!reviewName) throw new Error('Invalid review reference.');

  const response = await fetch(`https://mybusiness.googleapis.com/v4/${encodeURI(reviewName)}/reply`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const payload = (await response.json()) as { error?: { message?: string } };
    throw new Error(payload.error?.message || 'Unable to delete Google review reply.');
  }

  return {
    reviewName,
    deleted: true,
  };
}

export async function createGoogleBusinessProfileLocalPost(options: {
  businessId?: string;
  summary: string;
  languageCode?: string;
  topicType?: 'STANDARD' | 'EVENT' | 'OFFER' | 'ALERT';
  callToActionActionType?: 'BOOK' | 'ORDER' | 'SHOP' | 'LEARN_MORE' | 'SIGN_UP' | 'CALL';
  callToActionUrl?: string;
}) {
  const summary = options.summary.trim();
  if (!summary) throw new Error('Post summary is required.');

  const { config, accessToken } = await resolveGoogleBusinessProfileConnectionContext(options.businessId);
  const payload: Record<string, unknown> = {
    languageCode: options.languageCode?.trim() || 'en-US',
    summary,
    topicType: options.topicType ?? 'STANDARD',
  };

  const callToActionUrl = options.callToActionUrl?.trim() ?? '';
  if (options.callToActionActionType && callToActionUrl) {
    payload.callToAction = {
      actionType: options.callToActionActionType,
      url: callToActionUrl,
    };
  }

  const response = await fetch(
    `https://mybusiness.googleapis.com/v4/accounts/${encodeURIComponent(
      config.accountId
    )}/locations/${encodeURIComponent(config.locationId)}/localPosts`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    }
  );

  const post = (await response.json()) as GoogleLocalPost & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(post.error?.message || 'Unable to create Google Business Profile post.');
  }

  return {
    name: post.name ?? null,
    summary: post.summary ?? summary,
    state: post.state ?? null,
    searchUrl: post.searchUrl ?? null,
    topicType: post.topicType ?? (options.topicType ?? 'STANDARD'),
    createTime: post.createTime ?? null,
    updateTime: post.updateTime ?? null,
    callToAction: post.callToAction ?? null,
  };
}

export async function listGoogleBusinessProfileLocalPosts(options?: {
  businessId?: string;
  pageSize?: number;
}) {
  const { config, accessToken } = await resolveGoogleBusinessProfileConnectionContext(options?.businessId);
  const posts: GoogleLocalPost[] = [];
  const pageSize = Math.max(1, Math.min(100, options?.pageSize ?? 25));
  let pageToken: string | null = null;
  let pages = 0;

  do {
    const url = new URL(
      `https://mybusiness.googleapis.com/v4/accounts/${encodeURIComponent(
        config.accountId
      )}/locations/${encodeURIComponent(config.locationId)}/localPosts`
    );
    url.searchParams.set('pageSize', String(pageSize));
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    const raw = await response.text();
    let payload: GoogleLocalPostsListResponse & { error?: { message?: string } } = {};
    if (raw) {
      try {
        payload = JSON.parse(raw) as GoogleLocalPostsListResponse & { error?: { message?: string } };
      } catch {
        payload = {};
      }
    }
    if (!response.ok) {
      const contentType = response.headers.get('content-type') ?? '';
      const fallbackMessage = contentType.includes('text/html')
        ? 'Google Business Profile post history is temporarily unavailable due to an upstream service error.'
        : raw.slice(0, 300);
      throw new Error(
        payload.error?.message ||
          fallbackMessage ||
          `Unable to fetch Google Business Profile posts (HTTP ${response.status}).`
      );
    }

    posts.push(...(payload.localPosts ?? []));
    pageToken = payload.nextPageToken ?? null;
    pages += 1;
  } while (pageToken && pages < 5);

  return posts;
}

type GoogleBusinessProfilePerformanceMetric =
  | 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH'
  | 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH'
  | 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS'
  | 'BUSINESS_IMPRESSIONS_MOBILE_MAPS'
  | 'WEBSITE_CLICKS'
  | 'CALL_CLICKS'
  | 'BUSINESS_DIRECTION_REQUESTS';

export async function getGoogleBusinessProfilePerformanceSummary(options?: {
  businessId?: string;
  days?: number;
}) {
  const { config, accessToken } = await resolveGoogleBusinessProfileConnectionContext(options?.businessId);
  const days = Math.max(1, Math.min(90, Math.round(options?.days ?? 30)));
  const endDate = new Date();
  const startDate = new Date();
  startDate.setUTCDate(endDate.getUTCDate() - (days - 1));

  const dailyMetrics: GoogleBusinessProfilePerformanceMetric[] = [
    'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
    'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
    'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
    'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
    'WEBSITE_CLICKS',
    'CALL_CLICKS',
    'BUSINESS_DIRECTION_REQUESTS',
  ];

  const start = toGoogleDateParts(startDate);
  const end = toGoogleDateParts(endDate);
  const url = new URL(
    `https://businessprofileperformance.googleapis.com/v1/locations/${encodeURIComponent(
      config.locationId
    )}:fetchMultiDailyMetricsTimeSeries`
  );
  for (const metric of dailyMetrics) {
    url.searchParams.append('dailyMetrics', metric);
  }
  url.searchParams.set('dailyRange.startDate.year', String(start.year ?? ''));
  url.searchParams.set('dailyRange.startDate.month', String(start.month ?? ''));
  url.searchParams.set('dailyRange.startDate.day', String(start.day ?? ''));
  url.searchParams.set('dailyRange.endDate.year', String(end.year ?? ''));
  url.searchParams.set('dailyRange.endDate.month', String(end.month ?? ''));
  url.searchParams.set('dailyRange.endDate.day', String(end.day ?? ''));

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  const raw = await response.text();
  let payload: GoogleBusinessProfilePerformanceResponse = {};
  if (raw) {
    try {
      payload = JSON.parse(raw) as GoogleBusinessProfilePerformanceResponse;
    } catch {
      payload = {};
    }
  }
  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? '';
    const fallbackMessage = contentType.includes('text/html')
      ? 'Google Business Profile Performance API returned HTML instead of JSON. Confirm the API is enabled and OAuth scope/permissions are correct.'
      : raw.slice(0, 300);
    throw new Error(
      payload.error?.message ||
        fallbackMessage ||
        `Unable to fetch Google Business Profile performance data (HTTP ${response.status}).`
    );
  }

  const containers = payload.multiDailyMetricTimeSeries ?? [];
  const series = containers.flatMap((container) => {
    const nested = container.dailyMetricTimeSeries ?? [];
    if (nested.length > 0) return nested;
    // Backward-compatible fallback if Google returns a flattened shape.
    return [container as unknown as GoogleBusinessProfileMetricSeries];
  });
  const byMetric = new Map<string, Map<string, number>>();
  const allDates = new Set<string>();

  for (const metricSeries of series) {
    const metric = (metricSeries.dailyMetric ?? '').trim();
    if (!metric) continue;
    const metricValues = new Map<string, number>();

    for (const point of metricSeries.timeSeries?.datedValues ?? []) {
      const date = toIsoDateFromParts(point.date);
      if (!date) continue;
      metricValues.set(date, toMetricValue(point.value));
      allDates.add(date);
    }

    byMetric.set(metric, metricValues);
  }

  const readMetricTotal = (metrics: string[]) => {
    let total = 0;
    for (const metric of metrics) {
      const values = byMetric.get(metric);
      if (!values) continue;
      for (const value of values.values()) total += value;
    }
    return total;
  };

  const sortedDates = Array.from(allDates).sort((a, b) => a.localeCompare(b));
  const rows = sortedDates.map((date) => {
    const searchImpressions =
      (byMetric.get('BUSINESS_IMPRESSIONS_DESKTOP_SEARCH')?.get(date) ?? 0) +
      (byMetric.get('BUSINESS_IMPRESSIONS_MOBILE_SEARCH')?.get(date) ?? 0);
    const mapsImpressions =
      (byMetric.get('BUSINESS_IMPRESSIONS_DESKTOP_MAPS')?.get(date) ?? 0) +
      (byMetric.get('BUSINESS_IMPRESSIONS_MOBILE_MAPS')?.get(date) ?? 0);
    const websiteClicks = byMetric.get('WEBSITE_CLICKS')?.get(date) ?? 0;
    const callClicks = byMetric.get('CALL_CLICKS')?.get(date) ?? 0;
    const directionRequests = byMetric.get('BUSINESS_DIRECTION_REQUESTS')?.get(date) ?? 0;

    return {
      date,
      searchImpressions,
      mapsImpressions,
      websiteClicks,
      callClicks,
      directionRequests,
    };
  });

  return {
    businessId: config.businessId,
    locationId: config.locationId,
    days,
    totals: {
      searchImpressions: readMetricTotal([
        'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
        'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
      ]),
      mapsImpressions: readMetricTotal([
        'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
        'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
      ]),
      websiteClicks: readMetricTotal(['WEBSITE_CLICKS']),
      callClicks: readMetricTotal(['CALL_CLICKS']),
      directionRequests: readMetricTotal(['BUSINESS_DIRECTION_REQUESTS']),
    },
    byDay: rows,
  };
}
