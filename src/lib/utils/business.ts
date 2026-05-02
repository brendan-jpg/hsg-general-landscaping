import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { getMediaRoleFromMetadata } from '@/lib/media/roles';
import { createClient, createPublicClient } from '@/lib/supabase/server';
import type { Business, SeoSettings, NavigationMenu } from '@/lib/types';

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

function isLoopbackHost(host: string) {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

function normalizeDomain(value: string | null | undefined) {
  return (value ?? '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

function asSettingsObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

function isTransientPublicQueryError(message: string) {
  const normalized = message.trim().toLowerCase();
  return (
    normalized === 'internal server error.' ||
    normalized === 'internal server error' ||
    normalized.includes('bad gateway') ||
    normalized.includes('error code 502') ||
    normalized.includes('cloudflare')
  );
}

export async function getBusinessBrandAssetUrls(businessId: string) {
  const supabase = createPublicClient();
  const { data: mediaRows, error: mediaError } = await supabase
    .from('media')
    .select('file_url, metadata, created_at')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(120);

  if (mediaError) {
    if (isTransientPublicQueryError(mediaError.message)) {
      console.warn('Business brand assets unavailable due to transient upstream error:', mediaError.message);
      return {
        logoUrl: null,
        faviconUrl: null,
      };
    }
    throw new Error(mediaError.message);
  }

  const logoRow = (mediaRows ?? []).find((row) => getMediaRoleFromMetadata(row.metadata) === 'logo');
  const iconRow = (mediaRows ?? []).find((row) => getMediaRoleFromMetadata(row.metadata) === 'icon');

  return {
    logoUrl: logoRow?.file_url ?? null,
    faviconUrl: iconRow?.file_url ?? null,
  };
}

const getCachedBusinessBrandAssetUrls = unstable_cache(
  async (businessId: string) => getBusinessBrandAssetUrls(businessId),
  ['public-business-brand-assets'],
  { revalidate: 300, tags: ['public-business-brand-assets'] },
);

export async function applyBrandAssetsToBusiness<T extends Pick<Business, 'id' | 'logo_url' | 'settings'>>(
  business: T | null,
): Promise<(T & Pick<Business, 'logo_url' | 'settings'>) | null> {
  if (!business) return null;

  const assets = await getCachedBusinessBrandAssetUrls(business.id);
  const settings = asSettingsObject(business.settings);

  if (assets.faviconUrl) {
    settings.favicon_url = assets.faviconUrl;
  } else if (typeof settings.favicon_url !== 'string') {
    settings.favicon_url = null;
  }

  return {
    ...business,
    logo_url: assets.logoUrl ?? business.logo_url ?? null,
    settings,
  };
}

const getBusinessByIdCached = unstable_cache(
  async (businessId: string): Promise<Business | null> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return applyBrandAssetsToBusiness((data ?? null) as Business | null);
  },
  ['public-business-by-id'],
  { revalidate: 300, tags: ['public-business-by-id'] },
);

const getBusinessBySlugCached = unstable_cache(
  async (businessSlug: string): Promise<Business | null> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('slug', businessSlug)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return applyBrandAssetsToBusiness((data ?? null) as Business | null);
  },
  ['public-business-by-slug'],
  { revalidate: 300, tags: ['public-business-by-slug'] },
);

const getBusinessByResolvedHostCached = unstable_cache(
  async (resolvedHost: string): Promise<Business | null> => {
    const supabase = createPublicClient();
    const { data: domainEntry, error: domainError } = await supabase
      .from('business_domains')
      .select('business_id')
      .eq('domain', resolvedHost)
      .eq('is_active', true)
      .maybeSingle();
    if (domainError) throw new Error(domainError.message);

    if (domainEntry?.business_id) {
      return getBusinessByIdCached(domainEntry.business_id as string);
    }

    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('domain', resolvedHost)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return applyBrandAssetsToBusiness((data ?? null) as Business | null);
  },
  ['public-business-by-domain'],
  { revalidate: 300, tags: ['public-business-by-domain'] },
);

const getDefaultDevelopmentBusinessCached = unstable_cache(
  async (): Promise<Business | null> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return applyBrandAssetsToBusiness(data as Business);
  },
  ['public-default-business'],
  { revalidate: 300, tags: ['public-default-business'] },
);

// Cached per-request; call this anywhere in server components.
export const getBusiness = cache(async (): Promise<Business | null> => {
  const businessId = process.env.BUSINESS_ID?.trim();
  if (businessId) {
    return getBusinessByIdCached(businessId);
  }

  const businessSlug = process.env.BUSINESS_SLUG?.trim();
  if (businessSlug) {
    return getBusinessBySlugCached(businessSlug);
  }

  // Optional multi-tenant host/domain resolution (prod or custom local hosts).
  let resolvedHost = '';
  try {
    const { headers } = await import('next/headers');
    const headersList = await headers();
    const forwardedHost = normalizeHost(headersList.get('x-forwarded-host'));
    const host = normalizeHost(headersList.get('host'));
    resolvedHost = forwardedHost || host;

    if (resolvedHost && !isLoopbackHost(resolvedHost)) {
      return getBusinessByResolvedHostCached(resolvedHost);
    }
  } catch {
    // Header access can fail in some non-request contexts; continue to env/dev fallbacks.
  }

  // Backwards-compatible fallback for local development only.
  if (process.env.NODE_ENV !== 'production' || isLoopbackHost(resolvedHost)) {
    return getDefaultDevelopmentBusinessCached();
  }

  // In production multi-tenant mode, unknown domains should not bleed into another tenant.
  return null;
});

export const getResolvedBusinessDomain = cache(async (): Promise<string | null> => {
  const business = await getBusiness();
  if (!business) return null;

  const supabase = createPublicClient();

  let resolvedHost = '';
  try {
    const { headers } = await import('next/headers');
    const headersList = await headers();
    const forwardedHost = normalizeHost(headersList.get('x-forwarded-host'));
    const host = normalizeHost(headersList.get('host'));
    resolvedHost = forwardedHost || host;
  } catch {
    resolvedHost = '';
  }

  if (resolvedHost && !isLoopbackHost(resolvedHost)) {
    const { data: matchedDomain, error: matchedDomainError } = await supabase
      .from('business_domains')
      .select('domain, canonical_domain')
      .eq('business_id', business.id)
      .eq('domain', resolvedHost)
      .eq('is_active', true)
      .maybeSingle();
    if (matchedDomainError) throw new Error(matchedDomainError.message);

    const mappedHost = normalizeDomain(matchedDomain?.canonical_domain || matchedDomain?.domain);
    if (mappedHost) return mappedHost;
  }

  const { data: primaryDomain, error: primaryDomainError } = await supabase
    .from('business_domains')
    .select('domain, canonical_domain')
    .eq('business_id', business.id)
    .eq('is_primary', true)
    .eq('is_active', true)
    .maybeSingle();
  if (primaryDomainError) throw new Error(primaryDomainError.message);

  const mappedHost = normalizeDomain(primaryDomain?.canonical_domain || primaryDomain?.domain);
  if (mappedHost) return mappedHost;

  const fallbackDomain = normalizeDomain(business.domain);
  return fallbackDomain || null;
});

export const getSeoSettings = cache(async (): Promise<SeoSettings | null> => {
  const business = await getBusiness();
  if (!business) return null;

  return unstable_cache(
    async (businessId: string): Promise<SeoSettings | null> => {
      const publicSupabase = createPublicClient();
      const { data, error } = await publicSupabase
        .from('seo_settings')
        .select('*')
        .eq('business_id', businessId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return data ?? null;
    },
    ['public-seo-settings'],
    { revalidate: 300, tags: ['public-seo-settings'] },
  )(business.id);
});

export const getNavMenu = cache(async (location: 'header' | 'footer' | 'sidebar'): Promise<NavigationMenu | null> => {
  const business = await getBusiness();
  if (!business) return null;

  return unstable_cache(
    async (businessId: string, menuLocation: 'header' | 'footer' | 'sidebar'): Promise<NavigationMenu | null> => {
      const publicSupabase = createPublicClient();
      const { data, error } = await publicSupabase
        .from('navigation_menus')
        .select('*')
        .eq('business_id', businessId)
        .eq('location', menuLocation)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw new Error(error.message);
      return data ?? null;
    },
    ['public-navigation-menu'],
    { revalidate: 300, tags: ['public-navigation-menu'] },
  )(business.id, location);
});

export function getBusinessSettingString(settings: unknown, key: string) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return '';
  const value = (settings as Record<string, unknown>)[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function getBusinessSettingBoolean(settings: unknown, key: string) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return false;
  return (settings as Record<string, unknown>)[key] === true;
}
