import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

type CanonicalCacheEntry = {
  canonicalHost: string | null;
  expiresAt: number;
};

type DomainLookupResult = {
  businessId: string | null;
  canonicalHost: string | null;
};

type RedirectLookupRow = {
  from_path?: string | null;
  to_path?: string | null;
  type?: '301' | '302' | null;
};

type BusinessBrandLookupResult = {
  faviconUrl: string | null;
};

const canonicalHostCache = new Map<string, CanonicalCacheEntry>();
const domainLookupCache = new Map<string, { value: DomainLookupResult; expiresAt: number }>();
const redirectLookupCache = new Map<string, { value: RedirectLookupRow[]; expiresAt: number }>();
const businessBrandCache = new Map<string, { value: BusinessBrandLookupResult; expiresAt: number }>();
const CANONICAL_CACHE_TTL_MS = 5 * 60 * 1000;

function normalizeDashboardRole(role: string | null | undefined): 'admin' | 'employee' {
  if (role === 'owner' || role === 'admin') return 'admin';
  return 'employee';
}

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

function normalizeRedirectPath(value: string | null | undefined) {
  const raw = (value ?? '').trim();
  if (!raw) return '';

  const [pathnamePart, queryPart = ''] = raw.split('?', 2);
  const pathname = pathnamePart.trim();
  const normalizedPathname =
    !pathname || pathname === '/'
      ? '/'
      : `/${pathname.replace(/^\/+/, '').replace(/\/+$/, '')}`;

  return queryPart ? `${normalizedPathname}?${queryPart}` : normalizedPathname;
}

function isLoopbackHost(host: string) {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
}

function getPlatformAdminEmails() {
  return (process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function isPlatformAdminEmail(email: string | null | undefined) {
  const normalized = (email ?? '').trim().toLowerCase();
  if (!normalized) return false;
  const allowed = getPlatformAdminEmails();
  if (allowed.length === 0) return process.env.NODE_ENV !== 'production';
  return allowed.includes(normalized);
}

function getPlatformAdminHosts() {
  const configured = (process.env.PLATFORM_ADMIN_HOSTS || '')
    .split(',')
    .map((host) => normalizeHost(host))
    .filter(Boolean);
  if (configured.length > 0) return configured;
  return ['hsgrowth.com', 'www.hsgrowth.com'];
}

function isPlatformHost(host: string | null | undefined) {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  if (isLoopbackHost(normalized)) return true;
  return getPlatformAdminHosts().includes(normalized);
}

async function lookupDomain(host: string): Promise<DomainLookupResult> {
  const now = Date.now();
  const cached = domainLookupCache.get(host);
  if (cached && cached.expiresAt > now) return cached.value;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!supabaseUrl || !supabasePublishableKey) return { businessId: null, canonicalHost: null };

  const url = new URL('/rest/v1/business_domains', supabaseUrl);
  url.searchParams.set('select', 'business_id,domain,canonical_domain');
  url.searchParams.set('domain', `eq.${host}`);
  url.searchParams.set('is_active', 'eq.true');
  url.searchParams.set('limit', '1');

  const response = await fetch(url, {
    headers: {
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${supabasePublishableKey}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
  if (!response.ok) return { businessId: null, canonicalHost: null };

  const rows = (await response.json()) as Array<{
    business_id?: string | null;
    domain?: string | null;
    canonical_domain?: string | null;
  }>;
  const row = rows?.[0];
  const value = {
    businessId: row?.business_id?.trim() || null,
    canonicalHost: normalizeHost(row?.canonical_domain || row?.domain || null) || null,
  };
  domainLookupCache.set(host, {
    value,
    expiresAt: now + CANONICAL_CACHE_TTL_MS,
  });
  canonicalHostCache.set(host, {
    canonicalHost: value.canonicalHost,
    expiresAt: now + CANONICAL_CACHE_TTL_MS,
  });
  return value;
}

async function lookupCanonicalHost(host: string): Promise<string | null> {
  const now = Date.now();
  const cached = canonicalHostCache.get(host);
  if (cached && cached.expiresAt > now) return cached.canonicalHost;

  const result = await lookupDomain(host);
  return result.canonicalHost;
}

async function lookupRedirectsForBusiness(businessId: string): Promise<RedirectLookupRow[]> {
  const now = Date.now();
  const cached = redirectLookupCache.get(businessId);
  if (cached && cached.expiresAt > now) return cached.value;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!supabaseUrl || !supabasePublishableKey) return [];

  const url = new URL('/rest/v1/redirects', supabaseUrl);
  url.searchParams.set('select', 'from_path,to_path,type');
  url.searchParams.set('business_id', `eq.${businessId}`);
  url.searchParams.set('is_active', 'eq.true');
  url.searchParams.set('limit', '500');

  const response = await fetch(url, {
    headers: {
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${supabasePublishableKey}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
  if (!response.ok) return [];

  const rows = (await response.json()) as RedirectLookupRow[];
  const value = Array.isArray(rows) ? rows : [];
  redirectLookupCache.set(businessId, {
    value,
    expiresAt: now + CANONICAL_CACHE_TTL_MS,
  });
  return value;
}

async function lookupBusinessBranding(businessId: string): Promise<BusinessBrandLookupResult> {
  const now = Date.now();
  const cached = businessBrandCache.get(businessId);
  if (cached && cached.expiresAt > now) return cached.value;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!supabaseUrl || !supabasePublishableKey) return { faviconUrl: null };

  const url = new URL('/rest/v1/businesses', supabaseUrl);
  url.searchParams.set('select', 'settings');
  url.searchParams.set('id', `eq.${businessId}`);
  url.searchParams.set('limit', '1');

  const response = await fetch(url, {
    headers: {
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${supabasePublishableKey}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
  if (!response.ok) return { faviconUrl: null };

  const rows = (await response.json()) as Array<{ settings?: Record<string, unknown> | null }>;
  const row = rows?.[0];
  const faviconSetting = row?.settings?.favicon_url;
  const value = {
    faviconUrl: typeof faviconSetting === 'string' && faviconSetting.trim() ? faviconSetting.trim() : null,
  };

  businessBrandCache.set(businessId, {
    value,
    expiresAt: now + CANONICAL_CACHE_TTL_MS,
  });
  return value;
}

async function maybeRedirectToCanonicalHost(request: NextRequest) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;

  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith('/api/')) return null;

  const currentHost = normalizeHost(request.headers.get('x-forwarded-host') || request.headers.get('host'));
  if (!currentHost || isLoopbackHost(currentHost)) return null;

  const canonicalHost = await lookupCanonicalHost(currentHost);
  if (!canonicalHost || canonicalHost === currentHost) return null;

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.host = canonicalHost;
  redirectUrl.protocol = 'https';
  return NextResponse.redirect(redirectUrl, 308);
}

async function maybeRedirectFromConfiguredRules(request: NextRequest, businessId: string | null) {
  if (!businessId) return null;
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;

  const pathname = request.nextUrl.pathname;
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/_next/') ||
    pathname === '/login' ||
    pathname === '/reset-password'
  ) {
    return null;
  }

  const normalizedRequestPath = normalizeRedirectPath(`${pathname}${request.nextUrl.search}`);
  const normalizedRequestPathWithoutQuery = normalizeRedirectPath(pathname);
  const redirects = await lookupRedirectsForBusiness(businessId);
  const match = redirects.find((entry) => {
    const fromPath = normalizeRedirectPath(entry.from_path);
    return fromPath === normalizedRequestPath || fromPath === normalizedRequestPathWithoutQuery;
  });

  const targetPath = normalizeRedirectPath(match?.to_path);
  if (!match || !targetPath || targetPath === normalizedRequestPath || targetPath === normalizedRequestPathWithoutQuery) {
    return null;
  }

  const [targetPathname, targetSearch = ''] = targetPath.split('?', 2);
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = targetPathname || '/';
  redirectUrl.search = targetSearch ? `?${targetSearch}` : '';
  return NextResponse.redirect(redirectUrl, match.type === '302' ? 302 : 301);
}

async function maybeRedirectToTenantFavicon(request: NextRequest, businessId: string | null) {
  if (!businessId) return null;
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;
  if (request.nextUrl.pathname !== '/favicon.ico') return null;

  const branding = await lookupBusinessBranding(businessId);
  if (!branding.faviconUrl) return null;

  const redirectUrl = new URL(branding.faviconUrl, request.nextUrl.origin);
  return NextResponse.redirect(redirectUrl, 307);
}

function isAdminOnlyDashboardPath(pathname: string) {
  const adminPrefixes = [
    '/dashboard/settings',
    '/dashboard/automations',
    '/dashboard/content',
    '/dashboard/blog',
    '/dashboard/pages',
    '/dashboard/services',
    '/dashboard/areas',
    '/dashboard/team',
    '/dashboard/testimonials',
    '/dashboard/faqs',
    '/dashboard/platform',
  ];
  return adminPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isDomainMismatchExemptPath(pathname: string) {
  return pathname === '/reset-password' || pathname.startsWith('/reset-password/');
}

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies.getAll().some((cookie) => {
    const name = cookie.name.toLowerCase();
    return name.startsWith('sb-') && name.includes('auth-token');
  });
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isDashboardPath = pathname.startsWith('/dashboard');
  const isAuthPath = pathname === '/login' || pathname === '/reset-password' || pathname.startsWith('/reset-password/');
  const canonicalRedirect = await maybeRedirectToCanonicalHost(request);
  if (canonicalRedirect) return canonicalRedirect;

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the auth token
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const currentHost = normalizeHost(request.headers.get('x-forwarded-host') || request.headers.get('host'));
  const shouldRunTenantDomainLookups = true;
  const hostLookup =
    shouldRunTenantDomainLookups && currentHost && !isLoopbackHost(currentHost)
      ? await lookupDomain(currentHost)
      : { businessId: null, canonicalHost: null };

  if (shouldRunTenantDomainLookups) {
    const faviconRedirect = await maybeRedirectToTenantFavicon(request, hostLookup.businessId);
    if (faviconRedirect) return faviconRedirect;

    const redirectResponse = await maybeRedirectFromConfiguredRules(request, hostLookup.businessId);
    if (redirectResponse) return redirectResponse;
  }

  if (!isAuthPath && !hasSupabaseAuthCookie(request)) {
    return supabaseResponse;
  }

  let profile: { role?: string | null; business_id?: string | null; is_active?: boolean | null } | null = null;
  if (user && (isDashboardPath || (currentHost && !isLoopbackHost(currentHost)))) {
    const { data } = await supabase
      .from('profiles')
      .select('role, business_id, is_active')
      .eq('id', user.id)
      .maybeSingle();
    profile = data;
  }

  if (
    user &&
    (pathname === '/dashboard/platform' || pathname.startsWith('/dashboard/platform/')) &&
    (!isPlatformAdminEmail(user.email) || !isPlatformHost(currentHost))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (user && isAdminOnlyDashboardPath(pathname)) {
    if (
      profile &&
      hostLookup.businessId &&
      profile.business_id !== hostLookup.businessId &&
      !isPlatformAdminEmail(user.email) &&
      !isDomainMismatchExemptPath(pathname)
    ) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.search = '';
      url.searchParams.set('error', 'domain_mismatch');
      return NextResponse.redirect(url);
    }

    if (profile && profile.is_active === false) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.search = '';
      return NextResponse.redirect(url);
    }

    if (normalizeDashboardRole(profile?.role) !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  if (user) {
    if (currentHost && !isLoopbackHost(currentHost)) {
      if (
        profile &&
        hostLookup.businessId &&
        profile.business_id !== hostLookup.businessId &&
        !isPlatformAdminEmail(user.email) &&
        !isDomainMismatchExemptPath(pathname)
      ) {
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.search = '';
        url.searchParams.set('error', 'domain_mismatch');
        return NextResponse.redirect(url);
      }

      if (profile && profile.is_active === false) {
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.search = '';
        return NextResponse.redirect(url);
      }
    }
  }

  // Redirect logged-in users away from login page
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
