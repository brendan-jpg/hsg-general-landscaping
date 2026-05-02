import type { Business } from '@/lib/types';

type TokenValue = string | null | undefined;

function normalizeDomain(domain: string) {
  return domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

function getSiteUrl(business: Pick<Business, 'domain'> | null | undefined) {
  const domain = business?.domain?.trim();
  if (!domain) return '';
  return `https://${normalizeDomain(domain)}`;
}

function toAbsoluteUrl(url: TokenValue, business: Pick<Business, 'domain'> | null | undefined) {
  const value = url?.trim();
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  const siteUrl = getSiteUrl(business);
  if (!siteUrl) return value.startsWith('/') ? value : `/${value}`;
  return `${siteUrl}${value.startsWith('/') ? value : `/${value}`}`;
}

function buildPostalAddress(business: Business | null | undefined) {
  const hasAddress = Boolean(
    business?.address_line1?.trim() ||
      business?.city?.trim() ||
      business?.state?.trim() ||
      business?.zip?.trim(),
  );
  if (!hasAddress) return null;

  return {
    '@type': 'PostalAddress',
    streetAddress: business?.address_line1?.trim() || undefined,
    addressLocality: business?.city?.trim() || undefined,
    addressRegion: business?.state?.trim() || undefined,
    postalCode: business?.zip?.trim() || undefined,
    addressCountry: 'US',
  };
}

export function buildBaseSchemas(options: {
  business: Business | null;
  reviewUrl?: string | null;
}) {
  const { business, reviewUrl } = options;
  const siteUrl = getSiteUrl(business);
  if (!business || !siteUrl) return [];

  const logoUrl = toAbsoluteUrl(business.logo_url, business);
  const address = buildPostalAddress(business);
  const sameAs = reviewUrl?.trim() ? [reviewUrl.trim()] : undefined;

  return [
    {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: business.name,
      url: siteUrl,
      image: logoUrl || undefined,
      logo: logoUrl || undefined,
      telephone: business.phone?.trim() || undefined,
      email: business.email?.trim() || undefined,
      address: address || undefined,
      sameAs,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: business.name,
      url: siteUrl,
    },
  ];
}

export function buildWebPageSchema(options: {
  business: Business | null;
  title: string;
  description?: string | null;
  pathname: string;
}) {
  const siteUrl = getSiteUrl(options.business);
  if (!siteUrl) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: options.title,
    description: options.description?.trim() || undefined,
    url: `${siteUrl}${options.pathname.startsWith('/') ? options.pathname : `/${options.pathname}`}`,
  };
}

export function buildServiceSchema(options: {
  business: Business | null;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  pathname: string;
}) {
  const siteUrl = getSiteUrl(options.business);
  if (!siteUrl || !options.business) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: options.title,
    description: options.description?.trim() || undefined,
    url: `${siteUrl}${options.pathname.startsWith('/') ? options.pathname : `/${options.pathname}`}`,
    image: toAbsoluteUrl(options.imageUrl, options.business) || undefined,
    provider: {
      '@type': 'LocalBusiness',
      name: options.business.name,
      url: siteUrl,
    },
  };
}

export function buildAreaSchema(options: {
  business: Business | null;
  areaName: string;
  description?: string | null;
  pathname: string;
}) {
  const siteUrl = getSiteUrl(options.business);
  if (!siteUrl) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: options.areaName,
    description: options.description?.trim() || undefined,
    url: `${siteUrl}${options.pathname.startsWith('/') ? options.pathname : `/${options.pathname}`}`,
    about: {
      '@type': 'Place',
      name: options.areaName,
    },
  };
}

export function buildBlogPostingSchema(options: {
  business: Business | null;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  pathname: string;
  publishedAt?: string | null;
  updatedAt?: string | null;
}) {
  const siteUrl = getSiteUrl(options.business);
  if (!siteUrl || !options.business) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: options.title,
    description: options.description?.trim() || undefined,
    image: toAbsoluteUrl(options.imageUrl, options.business) || undefined,
    datePublished: options.publishedAt || options.updatedAt || undefined,
    dateModified: options.updatedAt || options.publishedAt || undefined,
    mainEntityOfPage: `${siteUrl}${options.pathname.startsWith('/') ? options.pathname : `/${options.pathname}`}`,
    publisher: {
      '@type': 'Organization',
      name: options.business.name,
      logo: toAbsoluteUrl(options.business.logo_url, options.business)
        ? {
            '@type': 'ImageObject',
            url: toAbsoluteUrl(options.business.logo_url, options.business),
          }
        : undefined,
    },
  };
}
