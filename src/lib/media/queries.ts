import { createClient } from '@/lib/supabase/server';
import { getCurrentDashboardBusinessId } from '@/lib/authz/dashboard';
import { getBusinessBrandAssetUrls } from '@/lib/utils/business';
import type { Tables } from '@/lib/types/database';

type Media = Tables<'media'>;
type Service = Tables<'services'>;
type Area = Tables<'areas'>;
type TeamMember = Tables<'team_members'>;
type BlogPost = Tables<'blog_posts'>;
type Page = Tables<'pages'>;
type Testimonial = Tables<'testimonials'>;

export type MediaUsageKind =
  | 'service'
  | 'service_gallery'
  | 'area'
  | 'team_member'
  | 'blog_post'
  | 'page'
  | 'testimonial';

export interface MediaUsageReference {
  kind: MediaUsageKind;
  entityId: string;
  label: string;
}

export interface DashboardMediaLibraryData {
  items: Media[];
  usageByUrl: Record<string, MediaUsageReference[]>;
  businessLogoUrl: string | null;
  businessFaviconUrl: string | null;
}

async function buildMediaUsageByUrl(businessId: string) {
  const supabase = await createClient();
  const [
    servicesResult,
    AreasResult,
    teamMembersResult,
    blogPostsResult,
    pagesResult,
    testimonialsResult,
  ] = await Promise.all([
    supabase
      .from('services')
      .select('id, title, featured_image_url, service_gallery_urls, before_after_groups, service_projects')
      .eq('business_id', businessId),
    supabase
      .from('areas')
      .select('id, name, featured_image_url')
      .eq('business_id', businessId),
    supabase
      .from('team_members')
      .select('id, first_name, last_name, title, photo_url')
      .eq('business_id', businessId),
    supabase
      .from('blog_posts')
      .select('id, title, featured_image_url')
      .eq('business_id', businessId),
    supabase
      .from('pages')
      .select('id, title, og_image_url')
      .eq('business_id', businessId),
    supabase
      .from('testimonials')
      .select('id, customer_name, avatar_url')
      .eq('business_id', businessId),
  ]);

  if (servicesResult.error) throw new Error(servicesResult.error.message);
  if (AreasResult.error) throw new Error(AreasResult.error.message);
  if (teamMembersResult.error) throw new Error(teamMembersResult.error.message);
  if (blogPostsResult.error) throw new Error(blogPostsResult.error.message);
  if (pagesResult.error) throw new Error(pagesResult.error.message);
  if (testimonialsResult.error) throw new Error(testimonialsResult.error.message);

  const usageByUrl: Record<string, MediaUsageReference[]> = {};

  for (const service of ((servicesResult.data ?? []) as Array<
    Pick<Service, 'id' | 'title' | 'featured_image_url' | 'service_gallery_urls'> & {
      before_after_groups?: unknown;
      service_projects?: unknown;
    }
  >)) {
    addUsage(usageByUrl, service.featured_image_url, {
      kind: 'service',
      entityId: service.id,
      label: service.title,
    });
    for (const url of toStringArray(service.service_gallery_urls)) {
      addUsage(usageByUrl, url, {
        kind: 'service_gallery',
        entityId: service.id,
        label: service.title,
      });
    }
    for (const url of collectServiceBeforeAfterUrls(service.before_after_groups)) {
      addUsage(usageByUrl, url, {
        kind: 'service_gallery',
        entityId: service.id,
        label: service.title,
      });
    }
    for (const url of collectServiceProjectUrls(service.service_projects)) {
      addUsage(usageByUrl, url, {
        kind: 'service_gallery',
        entityId: service.id,
        label: service.title,
      });
    }
  }

  for (const area of ((AreasResult.data ?? []) as Pick<Area, 'id' | 'name' | 'featured_image_url'>[])) {
    addUsage(usageByUrl, area.featured_image_url, {
      kind: 'area',
      entityId: area.id,
      label: area.name,
    });
  }

  for (const member of ((teamMembersResult.data ?? []) as Pick<TeamMember, 'id' | 'first_name' | 'last_name' | 'title' | 'photo_url'>[])) {
    const name = [member.first_name, member.last_name].filter(Boolean).join(' ').trim() || member.title || 'Team Member';
    addUsage(usageByUrl, member.photo_url, {
      kind: 'team_member',
      entityId: member.id,
      label: name,
    });
  }

  for (const post of ((blogPostsResult.data ?? []) as Pick<BlogPost, 'id' | 'title' | 'featured_image_url'>[])) {
    addUsage(usageByUrl, post.featured_image_url, {
      kind: 'blog_post',
      entityId: post.id,
      label: post.title,
    });
  }

  for (const page of ((pagesResult.data ?? []) as Pick<Page, 'id' | 'title' | 'og_image_url'>[])) {
    addUsage(usageByUrl, page.og_image_url, {
      kind: 'page',
      entityId: page.id,
      label: page.title,
    });
  }

  for (const testimonial of ((testimonialsResult.data ?? []) as Pick<Testimonial, 'id' | 'customer_name' | 'avatar_url'>[])) {
    addUsage(usageByUrl, testimonial.avatar_url, {
      kind: 'testimonial',
      entityId: testimonial.id,
      label: testimonial.customer_name,
    });
  }

  return usageByUrl;
}

function collectServiceBeforeAfterUrls(beforeAfterGroupsValue: unknown) {
  const urls: string[] = [];
  if (Array.isArray(beforeAfterGroupsValue)) {
    for (const group of beforeAfterGroupsValue) {
      if (!group || typeof group !== 'object' || Array.isArray(group)) continue;
      const row = group as Record<string, unknown>;
      urls.push(...toStringArray(row.before_urls), ...toStringArray(row.after_urls));
    }
  }
  return Array.from(new Set(urls));
}

function collectServiceProjectUrls(serviceProjectsValue: unknown) {
  if (!Array.isArray(serviceProjectsValue)) return [];
  const urls: string[] = [];
  for (const project of serviceProjectsValue) {
    if (!project || typeof project !== 'object' || Array.isArray(project)) continue;
    urls.push(...toStringArray((project as Record<string, unknown>).photo_urls));
  }
  return Array.from(new Set(urls));
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
}

function addUsage(
  usageByUrl: Record<string, MediaUsageReference[]>,
  url: string | null | undefined,
  ref: MediaUsageReference,
) {
  const normalized = (url ?? '').trim();
  if (!normalized) return;
  const current = usageByUrl[normalized] ?? [];
  if (!current.some((item) => item.kind === ref.kind && item.entityId === ref.entityId && item.label === ref.label)) {
    current.push(ref);
  }
  usageByUrl[normalized] = current;
}

async function getDashboardBusinessId() {
  return await getCurrentDashboardBusinessId();
}

export async function getDashboardMedia(options?: { imagesOnly?: boolean; limit?: number }) {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [];

  const supabase = await createClient();
  let query = supabase
    .from('media')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 120);

  if (options?.imagesOnly) {
    query = query.like('file_type', 'image/%');
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Media[];
}

export async function getDashboardMediaLibraryData(): Promise<DashboardMediaLibraryData> {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return { items: [], usageByUrl: {}, businessLogoUrl: null, businessFaviconUrl: null };

  const supabase = await createClient();
  const [mediaResult, usageByUrl, brandAssets] = await Promise.all([
    supabase
      .from('media')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(240),
    buildMediaUsageByUrl(businessId),
    getBusinessBrandAssetUrls(businessId),
  ]);

  if (mediaResult.error) throw new Error(mediaResult.error.message);

  return {
    items: (mediaResult.data ?? []) as Media[],
    usageByUrl,
    businessLogoUrl: brandAssets.logoUrl,
    businessFaviconUrl: brandAssets.faviconUrl,
  };
}

export async function getDashboardMediaUsageByUrl(): Promise<Record<string, MediaUsageReference[]>> {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return {};
  return buildMediaUsageByUrl(businessId);
}
