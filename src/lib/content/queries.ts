import { createClient, createPublicClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentDashboardBusinessId } from '@/lib/authz/dashboard';
import type { Json, Tables } from '@/lib/types/database';
import { getBusiness, getBusinessSettingString } from '@/lib/utils/business';
import { createTemplatePageContent, sanitizeTemplatePageContent, toTemplatePageContent } from '@/lib/sections/templatePages';
import {
  getRequiredDashboardPageByKind,
  getRequiredDashboardPageBySlug,
  isPageKind,
  REQUIRED_DASHBOARD_PAGES,
  type PageKind,
} from '@/lib/content/pageConfig';
import { listGoogleBusinessProfileLocalPosts } from '@/lib/integrations/googleBusinessProfile';
import { getActiveServices } from '@/lib/services/queries';

type BlogPost = Tables<'blog_posts'>;
type Page = Tables<'pages'>;
type Area = Tables<'areas'>;
type Service = Tables<'services'>;
type TeamMember = Tables<'team_members'>;
type TeamMemberEmployment = Tables<'team_member_employment'>;
type Testimonial = Tables<'testimonials'>;
type Faq = Tables<'faqs'>;

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

interface DashboardGoogleLocalPost {
  name: string;
  summary: string;
  topicType: string | null;
  state: string | null;
  searchUrl: string | null;
  createTime: string | null;
  updateTime: string | null;
  callToActionActionType: string | null;
  callToActionUrl: string | null;
}

const HERO_SECTION_TYPE_BY_TEMPLATE_KEY: Record<string, string> = {
  'about-page-v1': 'flexible_hero_section',
  'contact-page-v1': 'flexible_hero_section',
  'blog-archive-page-v1': 'flexible_hero_section',
  'services-archive-page-v1': 'flexible_hero_section',
  'areas-archive-page-v1': 'flexible_hero_section',
  'service-content-v1': 'flexible_hero_section',
  'area-content-v1': 'flexible_hero_section',
  'blog-post-content-v1': 'flexible_hero_section',
};

const ARCHIVE_GRID_SECTION_TYPE_BY_TEMPLATE_KEY: Record<string, string> = {
  'areas-archive-page-v1': 'area_grid_section',
  'services-archive-page-v1': 'service_grid_section',
  'blog-archive-page-v1': 'blog_grid_section',
};

function normalizePageHeroData(input: unknown) {
  const data = input && typeof input === 'object' && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};

  return {
    accent: typeof data.accent === 'string' ? data.accent.trim() : '',
    heading: typeof data.heading === 'string' ? data.heading.trim() : '{{page}}',
    lede: typeof data.lede === 'string' ? data.lede.trim() : '',
  };
}

export async function getDashboardBusinessId() {
  return await getCurrentDashboardBusinessId();
}

async function ensureRequiredDashboardPages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string,
) {
  const admin = createAdminClient();
  const { data, error: existingPagesError } = await supabase
    .from('pages')
    .select('id, slug, page_kind, content')
    .eq('business_id', businessId);

  if (existingPagesError) throw new Error(existingPagesError.message);

  let existingPages = (data ?? []) as Array<{ id: string; slug: string; page_kind: string | null; content: Json | null }>;
  const pagesMissingKind = existingPages
    .map((page) => {
      if (page.page_kind) return null;
      const required = getRequiredDashboardPageBySlug(page.slug === 'areas' ? 'service-areas' : page.slug);
      return required?.pageKind ? { id: page.id, page_kind: required.pageKind } : null;
    })
    .filter((page): page is { id: string; page_kind: PageKind } => Boolean(page));

  for (const page of pagesMissingKind) {
    const { error: updateError } = await admin
      .from('pages')
      .update({ page_kind: page.page_kind })
      .eq('id', page.id)
      .eq('business_id', businessId);
    if (updateError) throw new Error(updateError.message);
    existingPages = existingPages.map((existingPage) =>
      existingPage.id === page.id ? { ...existingPage, page_kind: page.page_kind } : existingPage,
    );
  }

  const existingRequiredKeys = new Set(
    existingPages.flatMap((page) => {
      const byKind = getRequiredDashboardPageByKind(page.page_kind);
      if (byKind) return [`kind:${byKind.pageKind}`];
      const bySlug = getRequiredDashboardPageBySlug(page.slug === 'areas' ? 'service-areas' : page.slug);
      return bySlug ? [`slug:${bySlug.slug}`] : [];
    }),
  );
  const missingPages = REQUIRED_DASHBOARD_PAGES.filter((page) => {
    if (page.pageKind) return !existingRequiredKeys.has(`kind:${page.pageKind}`);
    return !existingRequiredKeys.has(`slug:${page.slug}`);
  });
  if (missingPages.length > 0) {
    const insertRows = missingPages.map((page) => ({
      business_id: businessId,
      title: page.title,
      slug: page.slug,
      page_kind: page.pageKind,
      content: sanitizeTemplatePageContent(createTemplatePageContent(page.templateKey)) as unknown as Json,
      show_in_nav: page.showInNav,
      sort_order: page.sortOrder,
      is_active: true,
    }));

    const { error: insertError } = await admin.from('pages').insert(insertRows);
    if (insertError) throw new Error(insertError.message);
  }
  const pagesToUpgrade = existingPages.filter((page) => {
    const required = getRequiredDashboardPageByKind(page.page_kind) ?? getRequiredDashboardPageBySlug(page.slug);
    if (!required) return false;
    if (!['blog', 'service-areas'].includes(required.slug)) return false;
    const parsed = toTemplatePageContent(page.content);
    return parsed?.templateKey === 'content-page-v1';
  });

  const pagesToRetypeHeroes = existingPages.filter((page) => {
    const required = getRequiredDashboardPageByKind(page.page_kind) ?? getRequiredDashboardPageBySlug(page.slug);
    if (!required) return false;
    if (required.templateKey === 'content-page-v1') return false;
    const heroSectionType = HERO_SECTION_TYPE_BY_TEMPLATE_KEY[required.templateKey];
    if (!heroSectionType) return false;
    const parsed = toTemplatePageContent(page.content);
    if (parsed?.templateKey === 'content-page-v1') return false;
    return Boolean(parsed?.sections.some((section) => ['hero_standard', 'content_page_header'].includes(section.type)));
  });

  const pagesToRetypeArchiveGrids = existingPages.filter((page) => {
    const required = getRequiredDashboardPageByKind(page.page_kind) ?? getRequiredDashboardPageBySlug(page.slug);
    if (!required) return false;
    const nextArchiveGridType = ARCHIVE_GRID_SECTION_TYPE_BY_TEMPLATE_KEY[required.templateKey];
    if (!nextArchiveGridType) return false;

    const parsed = toTemplatePageContent(page.content);
    if (!parsed) return false;

    if (required.templateKey === 'areas-archive-page-v1') {
      return parsed.sections.some((section) =>
        ['area_archive_grid_section', 'service_area_grid_section'].includes(section.type),
      );
    }
    if (required.templateKey === 'services-archive-page-v1') {
      return parsed.sections.some((section) =>
        ['service_archive_grid_section', 'services_list_section'].includes(section.type),
      );
    }
    if (required.templateKey === 'blog-archive-page-v1') {
      return parsed.sections.some((section) => section.type === 'blog_archive_grid_section');
    }
    return false;
  });

  for (const page of pagesToUpgrade) {
    const required = getRequiredDashboardPageByKind(page.page_kind) ?? getRequiredDashboardPageBySlug(page.slug);
    if (!required) continue;

    const parsed = toTemplatePageContent(page.content);
    const nextContent = createTemplatePageContent(required.templateKey);
    const nextHeroType = HERO_SECTION_TYPE_BY_TEMPLATE_KEY[required.templateKey];
    const oldHero = parsed?.sections.find((section) => ['hero_standard', 'content_page_header'].includes(section.type));
    const nextHero = nextHeroType
      ? nextContent.sections.find((section) => section.type === nextHeroType)
      : undefined;
    if (oldHero && nextHero) {
      nextHero.data = normalizePageHeroData(oldHero.data);
    }

    const { error: updateError } = await admin
      .from('pages')
      .update({ content: sanitizeTemplatePageContent(nextContent) as unknown as Json })
      .eq('id', page.id)
      .eq('business_id', businessId);
    if (updateError) throw new Error(updateError.message);
  }

  for (const page of pagesToRetypeHeroes) {
    const required = getRequiredDashboardPageByKind(page.page_kind) ?? getRequiredDashboardPageBySlug(page.slug);
    if (!required) continue;

    const nextHeroType = HERO_SECTION_TYPE_BY_TEMPLATE_KEY[required.templateKey];
    const parsed = toTemplatePageContent(page.content);
    if (!parsed || !nextHeroType) continue;

    const nextContent = {
      ...parsed,
      sections: parsed.sections.map((section) => {
        if (!['hero_standard', 'content_page_header'].includes(section.type)) return section;
        return {
          ...section,
          slotId: 'hero',
          type: nextHeroType,
          data: normalizePageHeroData(section.data),
        };
      }),
    };

    const { error: updateError } = await admin
      .from('pages')
      .update({ content: sanitizeTemplatePageContent(nextContent) as unknown as Json })
      .eq('id', page.id)
      .eq('business_id', businessId);
    if (updateError) throw new Error(updateError.message);
  }

  for (const page of pagesToRetypeArchiveGrids) {
    const required = getRequiredDashboardPageByKind(page.page_kind) ?? getRequiredDashboardPageBySlug(page.slug);
    if (!required) continue;

    const nextArchiveGridType = ARCHIVE_GRID_SECTION_TYPE_BY_TEMPLATE_KEY[required.templateKey];
    const parsed = toTemplatePageContent(page.content);
    if (!parsed || !nextArchiveGridType) continue;

    const nextContent = {
      ...parsed,
      sections: parsed.sections.map((section) => {
        if (
          required.templateKey === 'areas-archive-page-v1' &&
          ['area_archive_grid_section', 'service_area_grid_section'].includes(section.type)
        ) {
          return {
            ...section,
            type: nextArchiveGridType,
            data: section.data,
          };
        }

        if (
          required.templateKey === 'services-archive-page-v1' &&
          ['service_archive_grid_section', 'services_list_section'].includes(section.type)
        ) {
          return {
            ...section,
            type: nextArchiveGridType,
            data: section.data,
          };
        }

        if (required.templateKey === 'blog-archive-page-v1' && section.type === 'blog_archive_grid_section') {
          return {
            ...section,
            type: nextArchiveGridType,
            data: section.data,
          };
        }

        return section;
      }),
    };

    const { error: updateError } = await admin
      .from('pages')
      .update({ content: sanitizeTemplatePageContent(nextContent) as unknown as Json })
      .eq('id', page.id)
      .eq('business_id', businessId);
    if (updateError) throw new Error(updateError.message);
  }
}

export async function getDashboardBlogPosts() {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as BlogPost[];
}

export async function getDashboardGoogleBusinessProfileLocalPosts() {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [] as DashboardGoogleLocalPost[];

  let posts;
  try {
    posts = await listGoogleBusinessProfileLocalPosts({ businessId, pageSize: 25 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load Google post history.';
    const normalized = message.toLowerCase();
    const isTransientUpstreamFailure =
      normalized.includes('temporarily unavailable') ||
      normalized.includes('bad gateway') ||
      normalized.includes('error code 502') ||
      normalized.includes('<!doctype html') ||
      normalized.includes('cloudflare');
    if (isTransientUpstreamFailure) {
      console.warn('Google Business Profile local post history unavailable due to upstream failure:', message);
      return [] as DashboardGoogleLocalPost[];
    }
    throw error;
  }

  return posts.map((post) => ({
    name: (post.name ?? '').trim(),
    summary: (post.summary ?? '').trim(),
    topicType: post.topicType ?? null,
    state: post.state ?? null,
    searchUrl: post.searchUrl ?? null,
    createTime: post.createTime ?? null,
    updateTime: post.updateTime ?? null,
    callToActionActionType: post.callToAction?.actionType ?? null,
    callToActionUrl: post.callToAction?.url ?? null,
  }));
}

export async function getDashboardBlogPostById(id: string) {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as BlogPost | null;
}

export async function getDashboardLinkedBlogPostServiceIds(blogPostId: string) {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [];

  const supabase = await createClient();
  const { data: validServices, error: servicesError } = await supabase
    .from('services')
    .select('id')
    .eq('business_id', businessId);
  if (servicesError) throw new Error(servicesError.message);

  const validServiceIds = new Set((validServices ?? []).map((row) => row.id));
  if (validServiceIds.size === 0) return [];

  const { data, error } = await supabase
    .from('blog_post_services')
    .select('service_id')
    .eq('blog_post_id', blogPostId);

  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((row) => row.service_id)
    .filter((serviceId) => validServiceIds.has(serviceId));
}

export async function getDashboardTeamMembers() {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [];

  const supabase = await createClient();
  const [{ data, error }, { data: employmentRows, error: employmentError }] = await Promise.all([
    supabase
    .from('team_members')
    .select('*')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true })
      .order('first_name', { ascending: true })
      .order('last_name', { ascending: true }),
    supabase
      .from('team_member_employment')
      .select('*')
      .eq('business_id', businessId),
  ]);

  if (error) throw new Error(error.message);
  if (employmentError) throw new Error(employmentError.message);

  const employmentByTeamMemberId = new Map(
    ((employmentRows ?? []) as TeamMemberEmployment[]).map((row) => [row.team_member_id, row])
  );

  return ((data ?? []) as TeamMember[]).map((member) => ({
    ...member,
    employment: employmentByTeamMemberId.get(member.id) ?? null,
  }));
}

export async function getDashboardTeamMemberById(id: string) {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return null;

  const supabase = await createClient();
  const [{ data, error }, { data: employment, error: employmentError }] = await Promise.all([
    supabase
      .from('team_members')
      .select('*')
      .eq('id', id)
      .eq('business_id', businessId)
      .maybeSingle(),
    supabase
      .from('team_member_employment')
      .select('*')
      .eq('team_member_id', id)
      .eq('business_id', businessId)
      .maybeSingle(),
  ]);

  if (error) throw new Error(error.message);
  if (employmentError) throw new Error(employmentError.message);
  if (!data) return null;

  return {
    ...(data as TeamMember),
    employment: (employment as TeamMemberEmployment | null) ?? null,
  };
}

export async function getDashboardTestimonials() {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('testimonials')
    .select('*')
    .eq('business_id', businessId)
    .order('review_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Testimonial[];
}

export async function getDashboardTestimonialById(id: string) {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('testimonials')
    .select('*')
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as Testimonial | null;
}

export async function getDashboardFaqs() {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('faqs')
    .select('*')
    .eq('business_id', businessId)
    .order('question', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Faq[];
}

export async function getDashboardFaqById(id: string) {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('faqs')
    .select('*')
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as Faq | null;
}

export async function getDashboardLinkedFaqServiceIds(faqId: string) {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [];

  const supabase = await createClient();
  const { data: validServices, error: servicesError } = await supabase
    .from('services')
    .select('id')
    .eq('business_id', businessId);
  if (servicesError) throw new Error(servicesError.message);

  const validServiceIds = new Set((validServices ?? []).map((row) => row.id));
  if (validServiceIds.size === 0) return [];

  const { data, error } = await supabase
    .from('faq_services')
    .select('service_id')
    .eq('faq_id', faqId);

  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((row) => row.service_id)
    .filter((serviceId) => validServiceIds.has(serviceId));
}

export async function getDashboardPages() {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [];

  const supabase = await createClient();
  await ensureRequiredDashboardPages(supabase, businessId);
  const { data, error } = await supabase
    .from('pages')
    .select('*')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Page[];
}

export async function getDashboardPageById(id: string) {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('pages')
    .select('*')
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as Page | null;
}

export async function getActivePageByKind(pageKind: PageKind) {
  const business = await getBusiness();
  if (!business) return null;

  const supabase = createPublicClient();
  await ensureRequiredDashboardPages(supabase, business.id);

  const { data, error } = await supabase
    .from('pages')
    .select('*')
    .eq('business_id', business.id)
    .eq('page_kind', pageKind)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as Page | null;
}

export async function getActivePagePathByKind(pageKind: PageKind) {
  const page = await getActivePageByKind(pageKind);
  if (!page?.slug?.trim()) return null;
  return `/${page.slug}`;
}

export async function getActiveArchivePagePaths() {
  const [servicesPath, areasPath] = await Promise.all([
    getActivePagePathByKind('services_archive'),
    getActivePagePathByKind('areas_archive'),
  ]);

  return {
    services: servicesPath ?? '/services',
    areas: areasPath ?? '/service-areas',
  };
}

export async function getActiveSystemPageHrefs() {
  const [aboutPath, blogPath, contactPath, archivePaths] = await Promise.all([
    getActivePagePathByKind('about'),
    getActivePagePathByKind('blog_archive'),
    getActivePagePathByKind('contact'),
    getActiveArchivePagePaths(),
  ]);
  return {
    home: '/',
    services: archivePaths.services,
    'service-areas': archivePaths.areas,
    about: aboutPath ?? '/about',
    blog: blogPath ?? '/blog',
    contact: contactPath ?? '/contact',
  };
}

export async function getDashboardAreas() {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('areas')
    .select('*')
    .eq('business_id', businessId)
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Area[];
}

export async function getDashboardAreaById(id: string) {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('areas')
    .select('*')
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as Area | null;
}

export async function getDashboardServicesForSelection() {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('services')
    .select('id, title')
    .eq('business_id', businessId)
    .order('title', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Pick<Service, 'id' | 'title'>[];
}

export async function getPublishedBlogPosts() {
  const business = await getBusiness();
  if (!business) return [];

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('business_id', business.id)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as BlogPost[];
}

export async function getPublishedBlogPostBySlug(slug: string) {
  const business = await getBusiness();
  if (!business) return null;

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('business_id', business.id)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as BlogPost | null;
}

export async function getPublishedBlogPostsForService(serviceId: string, limit = 3) {
  const business = await getBusiness();
  if (!business) return [];

  const supabase = createPublicClient();
  const { data: links, error: linksError } = await supabase
    .from('blog_post_services')
    .select('blog_post_id')
    .eq('service_id', serviceId);
  if (linksError) throw new Error(linksError.message);

  const blogPostIds = Array.from(new Set((links ?? []).map((row) => row.blog_post_id)));
  if (blogPostIds.length === 0) return [];

  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('business_id', business.id)
    .eq('status', 'published')
    .in('id', blogPostIds)
    .order('published_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as BlogPost[];
}

export async function getRelatedPublishedBlogPosts(postId: string, limit = 3) {
  const business = await getBusiness();
  if (!business) return [];

  const supabase = createPublicClient();
  const relatedMap = new Map<string, BlogPost>();

  const { data: currentPostLinks, error: currentLinksError } = await supabase
    .from('blog_post_services')
    .select('service_id')
    .eq('blog_post_id', postId);
  if (currentLinksError) throw new Error(currentLinksError.message);

  const serviceIds = Array.from(new Set((currentPostLinks ?? []).map((row) => row.service_id)));

  if (serviceIds.length > 0) {
    const { data: relatedLinks, error: relatedLinksError } = await supabase
      .from('blog_post_services')
      .select('blog_post_id')
      .in('service_id', serviceIds)
      .neq('blog_post_id', postId);
    if (relatedLinksError) throw new Error(relatedLinksError.message);

    const relatedIds = Array.from(new Set((relatedLinks ?? []).map((row) => row.blog_post_id)));
    if (relatedIds.length > 0) {
      const { data: relatedPosts, error: relatedPostsError } = await supabase
        .from('blog_posts')
        .select('*')
        .eq('business_id', business.id)
        .eq('status', 'published')
        .in('id', relatedIds)
        .order('published_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);
      if (relatedPostsError) throw new Error(relatedPostsError.message);

      for (const post of relatedPosts ?? []) {
        relatedMap.set(post.id, post as BlogPost);
      }
    }
  }

  if (relatedMap.size < limit) {
    const { data: fallbackPosts, error: fallbackError } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('business_id', business.id)
      .eq('status', 'published')
      .neq('id', postId)
      .order('published_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(Math.max(limit * 2, 6));
    if (fallbackError) throw new Error(fallbackError.message);

    for (const post of fallbackPosts ?? []) {
      if (relatedMap.size >= limit) break;
      relatedMap.set(post.id, post as BlogPost);
    }
  }

  return Array.from(relatedMap.values()).slice(0, limit);
}

export async function getActiveTestimonialsForService(serviceId: string, limit = 6) {
  return getActiveTestimonials({ serviceId, limit });
}

export async function getActiveTestimonialsForArea(areaId: string, limit = 6) {
  return getActiveTestimonials({ areaId, limit });
}

export async function getActiveTestimonials(options?: {
  serviceId?: string;
  serviceIds?: string[];
  areaId?: string;
  featuredOnly?: boolean;
  limit?: number;
}) {
  const business = await getBusiness();
  if (!business) return [];

  const supabase = createPublicClient();
  let query = supabase
    .from('testimonials')
    .select('*')
    .eq('business_id', business.id)
    .eq('is_active', true);

  const normalizedServiceIds = Array.isArray(options?.serviceIds)
    ? options.serviceIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    : [];

  if (normalizedServiceIds.length > 0) {
    query = query.in('service_id', normalizedServiceIds);
  } else if (options?.serviceId) {
    query = query.eq('service_id', options.serviceId);
  }

  if (options?.areaId) {
    query = query.eq('area_id', options.areaId);
  }

  if (options?.featuredOnly) {
    query = query.eq('is_featured', true);
  }

  const { data, error } = await query
    .order('is_featured', { ascending: false })
    .order('review_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 6);

  if (error) throw new Error(error.message);
  return (data ?? []) as Testimonial[];
}

export async function getPublicFaqs(options?: {
  global?: boolean;
  pageType?: string;
  pageId?: string;
  serviceId?: string;
}) {
  const business = await getBusiness();
  if (!business) return [];

  const supabase = createPublicClient();
  const faqMap = new Map<string, Faq>();

  if (options?.global) {
    const { data, error } = await supabase
      .from('faqs')
      .select('*')
      .eq('business_id', business.id)
      .eq('is_global', true)
      .order('question', { ascending: true });
    if (error) throw new Error(error.message);
    for (const faq of data ?? []) faqMap.set(faq.id, faq as Faq);
  } else {
    if (options?.pageType) {
      const { data, error } = await supabase
        .from('faqs')
        .select('*')
        .eq('business_id', business.id)
        .eq('is_global', false)
        .eq('page_type', options.pageType)
        .is('page_id', null)
        .order('question', { ascending: true });
      if (error) throw new Error(error.message);
      for (const faq of data ?? []) faqMap.set(faq.id, faq as Faq);
    }

    if (options?.pageType && options?.pageId) {
      const { data, error } = await supabase
        .from('faqs')
        .select('*')
        .eq('business_id', business.id)
        .eq('is_global', false)
        .eq('page_type', options.pageType)
        .eq('page_id', options.pageId)
        .order('question', { ascending: true });
      if (error) throw new Error(error.message);
      for (const faq of data ?? []) faqMap.set(faq.id, faq as Faq);
    }

    if (options?.serviceId) {
      const activeServices = await getActiveServices();
      const currentService = activeServices.find((service) => service.id === options.serviceId) ?? null;
      const familyRootId = currentService ? (currentService.parent_service_id ?? currentService.id) : options.serviceId;
      const relatedServiceIds = currentService
        ? activeServices
            .filter((service) => (service.parent_service_id ?? service.id) === familyRootId)
            .map((service) => service.id)
        : [options.serviceId];

      const { data: links, error: linkError } = await supabase
        .from('faq_services')
        .select('faq_id')
        .in('service_id', relatedServiceIds);
      if (linkError) throw new Error(linkError.message);

      const faqIds = (links ?? []).map((row) => row.faq_id);
      if (faqIds.length > 0) {
        const { data, error } = await supabase
          .from('faqs')
          .select('*')
          .eq('business_id', business.id)
          .in('id', faqIds)
          .order('question', { ascending: true });
        if (error) throw new Error(error.message);
        for (const faq of data ?? []) faqMap.set(faq.id, faq as Faq);
      }
    }
  }

  return Array.from(faqMap.values()).sort((a, b) => a.question.localeCompare(b.question));
}

export async function getTeamMembers() {
  const business = await getBusiness();
  if (!business) return [];

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('business_id', business.id)
    .eq('website_published', true)
    .order('sort_order', { ascending: true })
    .order('first_name', { ascending: true })
    .order('last_name', { ascending: true });

  if (error) {
    if (isTransientPublicQueryError(error.message)) {
      console.warn('Team members unavailable due to transient upstream error:', error.message);
      return [];
    }
    throw new Error(error.message);
  }
  return (data ?? []) as TeamMember[];
}

export async function getFeaturedTestimonials() {
  return getActiveTestimonials({ featuredOnly: true, limit: 10 });
}

export async function getGalleryImages(options?: { serviceId?: string; limit?: number }) {
  const business = await getBusiness();
  if (!business) return [] as Array<{ id: string; file_url: string; caption?: string | null }>;

  const limit = options?.limit ?? 24;
  const supabase = createPublicClient();
  const imageMap = new Map<string, { id: string; file_url: string; caption?: string | null }>();

  let query = supabase
    .from('projects')
    .select('id, title, gallery_urls')
    .eq('business_id', business.id)
    .order('project_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (options?.serviceId) {
    const { data: links, error: linksError } = await supabase
      .from('project_services')
      .select('project_id')
      .eq('service_id', options.serviceId);
    if (linksError) throw new Error(linksError.message);

    const projectIds = (links ?? []).map((row) => row.project_id);
    if (projectIds.length === 0) return [];
    query = query.in('id', projectIds);
  }

  const { data: projects, error } = await query.limit(20);
  if (error) throw new Error(error.message);

  for (const project of projects ?? []) {
    for (const url of project.gallery_urls ?? []) {
      if (!url || imageMap.has(url)) continue;
      imageMap.set(url, {
        id: `${project.id}-${url}`,
        file_url: url,
        caption: project.title,
      });
      if (imageMap.size >= limit) break;
    }
    if (imageMap.size >= limit) break;
  }

  return Array.from(imageMap.values());
}

export async function getActiveAreas() {
  const business = await getBusiness();
  if (!business) return [];

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('areas')
    .select('*')
    .eq('business_id', business.id)
    .order('name', { ascending: true });

  if (error) {
    if (isTransientPublicQueryError(error.message)) {
      console.warn('Active areas unavailable due to transient upstream error:', error.message);
      return [];
    }
    throw new Error(error.message);
  }
  return ((data ?? []) as Area[]).map((area) => applyDefaultAreaIcon(area, business));
}

export async function getActiveAreaBySlug(slug: string) {
  const business = await getBusiness();
  if (!business) return null;

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('areas')
    .select('*')
    .eq('business_id', business.id)
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return applyDefaultAreaIcon(data as Area | null, business);
}

export async function getActiveServiceBySlug(slug: string) {
  const business = await getBusiness();
  if (!business) return null;

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('business_id', business.id)
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as Service | null;
}

export async function getPrimaryServiceGalleryImages(limit = 3) {
  const business = await getBusiness();
  if (!business) return [] as Array<{ id: string; file_url: string; caption?: string | null }>;

  const supabase = createPublicClient();
  const { data: primaryService, error } = await supabase
    .from('services')
    .select('id, title, service_gallery_urls, featured_image_url')
    .eq('business_id', business.id)
    .eq('is_primary', true)
    .order('sort_order', { ascending: true })
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!primaryService?.id) return [];

  const galleryUrls = Array.isArray(primaryService.service_gallery_urls)
    ? primaryService.service_gallery_urls.filter((url): url is string => typeof url === 'string' && url.trim().length > 0)
    : [];

  const dedupedUrls = Array.from(new Set(galleryUrls.map((url) => url.trim())));
  const urls = dedupedUrls.length > 0
    ? dedupedUrls
    : primaryService.featured_image_url
      ? [primaryService.featured_image_url]
      : [];

  return urls.slice(0, limit).map((url, index) => ({
    id: `${primaryService.id}-primary-gallery-${index}`,
    file_url: url,
    caption: primaryService.title ?? null,
  }));
}

export async function getPrimaryServiceFeaturedImage() {
  const business = await getBusiness();
  if (!business) return null as { id: string; file_url: string; caption?: string | null } | null;

  const supabase = createPublicClient();
  const { data: primaryService, error } = await supabase
    .from('services')
    .select('id, title, featured_image_url')
    .eq('business_id', business.id)
    .eq('is_primary', true)
    .order('sort_order', { ascending: true })
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!primaryService?.id || !primaryService.featured_image_url?.trim()) return null;

  return {
    id: `${primaryService.id}-primary-featured-image`,
    file_url: primaryService.featured_image_url.trim(),
    caption: primaryService.title ?? null,
  };
}

export async function getPublicMediaImages(options?: { limit?: number }) {
  const business = await getBusiness();
  if (!business) return [] as Array<{ id: string; file_url: string; caption?: string | null }>;

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('media')
    .select('id, file_url, alt_text')
    .eq('business_id', business.id)
    .like('file_type', 'image/%')
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 3);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    file_url: row.file_url,
    caption: row.alt_text,
  }));
}

export async function getPublicMediaImageByFileNamePrefix(prefix: string) {
  const business = await getBusiness();
  if (!business) return null as { id: string; file_url: string; caption?: string | null } | null;

  const normalizedPrefix = prefix.trim();
  if (!normalizedPrefix) return null;

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('media')
    .select('id, file_url, alt_text, file_name')
    .eq('business_id', business.id)
    .like('file_type', 'image/%')
    .ilike('file_name', `${normalizedPrefix}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    id: data.id,
    file_url: data.file_url,
    caption: data.alt_text,
  };
}

export async function getActivePageBySlug(slug: string) {
  const business = await getBusiness();
  if (!business) return null;

  const supabase = createPublicClient();
  await ensureRequiredDashboardPages(supabase, business.id);
  const { data, error } = await supabase
    .from('pages')
    .select('*')
    .eq('business_id', business.id)
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if ((data as Page | null)?.page_kind === 'home') return null;
  return data as Page | null;
}


function applyDefaultAreaIcon<T extends Area | null>(area: T, business: Awaited<ReturnType<typeof getBusiness>>) {
  if (!area) return area;
  if (area.icon?.trim()) return area;
  const fallbackIcon = getBusinessSettingString(business?.settings, 'area_default_icon');
  return fallbackIcon ? ({ ...area, icon: fallbackIcon } as T) : area;
}
