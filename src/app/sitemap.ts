import type { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';
import { getActiveAreas, getPublishedBlogPosts } from '@/lib/content/queries';
import { getActiveServices } from '@/lib/services/queries';
import { buildAreaPath, buildServicePath } from '@/lib/utils/publicPaths';
import { getBusiness, getResolvedBusinessDomain, getSeoSettings } from '@/lib/utils/business';

function normalizePath(pathname: string) {
  if (!pathname) return '/';
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

function isExcluded(pathname: string, excludes: string[]) {
  const normalizedPath = normalizePath(pathname);
  return excludes.some((entry) => normalizePath(entry) === normalizedPath);
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [business, resolvedDomain] = await Promise.all([getBusiness(), getResolvedBusinessDomain()]);
  if (!business || !resolvedDomain) return [];

  const siteUrl = `https://${resolvedDomain}`;
  const supabase = await createClient();
  const [seoSettings, services, areas, blogPosts, pagesResult] = await Promise.all([
    getSeoSettings(),
    getActiveServices(),
    getActiveAreas(),
    getPublishedBlogPosts(),
    supabase
      .from('pages')
      .select('slug, updated_at, is_active, page_kind')
      .eq('business_id', business.id)
      .eq('is_active', true),
  ]);

  if (pagesResult.error) throw new Error(pagesResult.error.message);

  const excludes = (seoSettings?.sitemap_excludes ?? [])
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean);

  const entries: MetadataRoute.Sitemap = [];
  const pushEntry = (pathname: string, lastModified?: string | null) => {
    if (isExcluded(pathname, excludes)) return;
    entries.push({
      url: `${siteUrl}${normalizePath(pathname)}`,
      lastModified: lastModified ? new Date(lastModified) : undefined,
    });
  };

  pushEntry('/', business.updated_at ?? null);

  for (const page of pagesResult.data ?? []) {
    const slug = page.slug?.trim();
    if (!slug || page.page_kind === 'home') continue;
    pushEntry(`/${slug}`, page.updated_at ?? null);
  }

  for (const service of services) {
    if (!service.slug) continue;
    pushEntry(buildServicePath(service.slug, business.settings), service.updated_at ?? null);
  }

  for (const area of areas) {
    if (!area.slug) continue;
    pushEntry(buildAreaPath(area.slug, business.settings), area.updated_at ?? null);
  }

  for (const post of blogPosts) {
    if (!post.slug) continue;
    pushEntry(`/blog/${post.slug}`, post.updated_at ?? post.published_at ?? post.created_at ?? null);
  }

  return entries;
}
