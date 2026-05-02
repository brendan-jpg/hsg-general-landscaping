import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getBusiness, getSeoSettings } from '@/lib/utils/business';

type TokenValue = string | number | null | undefined;

interface DynamicMetadataOptions {
  titleTemplate?: string | null;
  descriptionTemplate?: string | null;
  fallbackTitle: string;
  fallbackDescription?: string | null;
  imageUrl?: string | null;
  pathname?: string;
  tokens?: Record<string, TokenValue>;
  absoluteTitle?: boolean;
}

function interpolateTemplate(template: string, tokens: Record<string, TokenValue>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const value = tokens[key];
    return value === null || value === undefined ? '' : String(value);
  });
}

function normalizeDomain(domain: string) {
  const stripped = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return stripped;
}

function toAbsoluteUrl(url: string, domain: string) {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const path = url.startsWith('/') ? url : `/${url}`;
  return `https://${normalizeDomain(domain)}${path}`;
}

export async function buildDynamicMetadata(options: DynamicMetadataOptions): Promise<Metadata> {
  const [business, seoSettings] = await Promise.all([getBusiness(), getSeoSettings()]);
  const supabase = await createClient();

  const primaryServiceTitle = business
    ? await (async () => {
        const { data, error } = await supabase
          .from('services')
          .select('title')
          .eq('business_id', business.id)
          .eq('is_primary', true)
          .order('sort_order', { ascending: true })
          .order('title', { ascending: true })
          .limit(1)
          .maybeSingle();
        if (error) return '';
        return data?.title ?? '';
      })()
    : '';

  const normalizedPath = options.pathname
    ? options.pathname.startsWith('/')
      ? options.pathname
      : `/${options.pathname}`
    : '';
  const domain = business?.domain?.trim();
  const normalizedDomain = domain ? normalizeDomain(domain) : '';
  const siteUrl = normalizedDomain ? `https://${normalizedDomain}` : '';
  const pageUrl = normalizedPath ? `${siteUrl}${normalizedPath}` : '';

  const baseTokens: Record<string, TokenValue> = {
    business: business?.name ?? '',
    city: business?.city ?? '',
    state: business?.state ?? '',
    state_code: business?.state ?? '',
    primary_area: business?.city ?? '',
    primary_service: primaryServiceTitle,
    url: pageUrl || normalizedPath,
    page_url: pageUrl || normalizedPath,
    site_url: siteUrl,
    ...options.tokens,
  };

  const rawTitle = (options.titleTemplate || options.fallbackTitle || '').trim();
  const title = interpolateTemplate(rawTitle, baseTokens).trim() || options.fallbackTitle;
  const finalTitle = title;
  const metadataTitle: Metadata['title'] = options.absoluteTitle ? { absolute: finalTitle } : finalTitle;

  const rawDescription = (options.descriptionTemplate || options.fallbackDescription || '').trim();
  const description = rawDescription ? interpolateTemplate(rawDescription, baseTokens).trim() : undefined;

  const canonical =
    normalizedDomain && normalizedPath
      ? `https://${normalizedDomain}${normalizedPath}`
      : undefined;

  const resolvedImageUrl = options.imageUrl || seoSettings?.og_image_url || undefined;
  const absoluteImage =
    resolvedImageUrl && domain ? toAbsoluteUrl(resolvedImageUrl, domain) : resolvedImageUrl ?? undefined;

  return {
    title: metadataTitle,
    description,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      title: finalTitle,
      description,
      url: canonical,
      images: absoluteImage ? [absoluteImage] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: finalTitle,
      description,
      images: absoluteImage ? [absoluteImage] : undefined,
    },
  };
}
