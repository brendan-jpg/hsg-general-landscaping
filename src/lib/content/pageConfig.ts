export const PROTECTED_PAGE_SLUGS = ['home', 'services', 'service-areas', 'about', 'blog', 'contact'] as const;

export type ProtectedPageSlug = (typeof PROTECTED_PAGE_SLUGS)[number];
export const PAGE_KINDS = ['home', 'services_archive', 'areas_archive', 'about', 'blog_archive', 'contact'] as const;
export type PageKind = (typeof PAGE_KINDS)[number];

export interface RequiredDashboardPageDefinition {
  pageKind: PageKind | null;
  slug: ProtectedPageSlug;
  title: string;
  showInNav: boolean;
  sortOrder: number;
  templateKey:
    | 'home-page-v1'
    | 'content-page-v1'
    | 'services-archive-page-v1'
    | 'about-page-v1'
    | 'contact-page-v1'
    | 'blog-archive-page-v1'
    | 'areas-archive-page-v1';
}

export const REQUIRED_DASHBOARD_PAGES: ReadonlyArray<RequiredDashboardPageDefinition> = [
  { pageKind: 'home', slug: 'home', title: 'Home', showInNav: true, sortOrder: 0, templateKey: 'home-page-v1' },
  { pageKind: 'services_archive', slug: 'services', title: 'Our Services', showInNav: true, sortOrder: 20, templateKey: 'services-archive-page-v1' },
  { pageKind: 'areas_archive', slug: 'service-areas', title: 'Areas We Serve', showInNav: true, sortOrder: 30, templateKey: 'areas-archive-page-v1' },
  { pageKind: 'about', slug: 'about', title: 'About', showInNav: true, sortOrder: 35, templateKey: 'about-page-v1' },
  { pageKind: 'blog_archive', slug: 'blog', title: 'Blog', showInNav: true, sortOrder: 40, templateKey: 'blog-archive-page-v1' },
  { pageKind: 'contact', slug: 'contact', title: 'Contact', showInNav: true, sortOrder: 90, templateKey: 'contact-page-v1' },
];

export function isProtectedPageSlug(slug: string | null | undefined): slug is ProtectedPageSlug {
  if (!slug) return false;
  return (PROTECTED_PAGE_SLUGS as readonly string[]).includes(slug);
}

export function isPageKind(value: string | null | undefined): value is PageKind {
  if (!value) return false;
  return (PAGE_KINDS as readonly string[]).includes(value);
}

export function getRequiredDashboardPageBySlug(slug: string | null | undefined) {
  if (!slug) return null;
  return REQUIRED_DASHBOARD_PAGES.find((page) => page.slug === slug) ?? null;
}

export function getRequiredDashboardPageByKind(pageKind: string | null | undefined) {
  if (!isPageKind(pageKind)) return null;
  return REQUIRED_DASHBOARD_PAGES.find((page) => page.pageKind === pageKind) ?? null;
}

export function isProtectedPage(page: { slug?: string | null; page_kind?: string | null } | null | undefined) {
  if (!page) return false;
  return isPageKind(page.page_kind) || isProtectedPageSlug(page.slug);
}
