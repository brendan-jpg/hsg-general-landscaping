import type { ComponentType } from 'react';
import type { Json } from '@/lib/types/database';

type FrontendFormField = {
  id: string;
  name: string;
  label: string;
  type: string;
  placeholder?: string;
  required?: boolean;
  helpText?: string;
  options?: string[];
  row?: number;
  span?: number;
  enableGoogleMaps?: boolean;
};

type BlogPost = {
  id: string;
  title?: string | null;
  excerpt?: string | null;
  featured_image_url?: string | null;
  published_at?: string | null;
  created_at: string;
  read_time_minutes?: number | null;
};
export type Service = {
  id: string;
  title?: string | null;
  slug?: string | null;
  excerpt?: string | null;
  featured_image_url?: string | null;
  icon?: string | null;
  parent_service_id?: string | null;
  is_primary?: boolean | null;
};
type ServiceArea = {
  id: string;
  name?: string | null;
  slug?: string | null;
  excerpt?: string | null;
  icon?: string | null;
  featured_image_url?: string | null;
};
type Testimonial = {
  id: string;
  content?: string | null;
  customer_name?: string | null;
  area_id?: string | null;
  service_id?: string | null;
};
type TeamMember = { id: string; title?: string | null };
type Business = {
  id: string;
  name?: string | null;
  city?: string | null;
  state?: string | null;
  domain?: string | null;
  logo_url?: string | null;
  settings?: Json | null;
};
interface BeforeAfterGroup {}
interface ProjectItem {
  title?: string | null;
  summary?: string | null;
  photo_urls?: string[];
  area_ids?: string[];
  service_title?: string;
}

interface GalleryItem {
  id: string;
  file_url: string;
  caption?: string | null;
}

interface ContactRenderContext {
  business: Business | null;
  services: Service[];
  businessId: string;
  configuredFields?: FrontendFormField[];
  formId?: string;
}

export interface TemplatePageRenderContext {
  url?: string;
  page?: { title?: string | null; metaDescription?: string | null };
  business?: Business | null;
  ctaDefaults?: {
    primaryLabel?: string;
    primaryHref?: string;
    secondaryLabel?: string;
    secondaryHref?: string;
  };
  services?: Service[];
  allServices?: Service[];
  serviceAreas?: ServiceArea[];
  testimonials?: Testimonial[];
  hasFamilyTestimonials?: boolean;
  teamMembers?: TeamMember[];
  projects?: ProjectItem[];
  galleryImages?: GalleryItem[];
  service?: Service | null;
  parentService?: Service | null;
  childServices?: Service[];
  relatedBlogPosts?: BlogPost[];
  beforeAfterGroups?: BeforeAfterGroup[];
  area?: ServiceArea | null;
  blogPost?: BlogPost | null;
  blogPublishedLabel?: string;
  blogArchivePosts?: BlogPost[];
  blogArchivePagination?: {
    currentPage: number;
    totalPages: number;
    basePath?: string;
  };
  contact?: ContactRenderContext;
}

export interface TemplatePageRendererAdapter {
  getActiveFormById: (id: string) => Promise<{ id?: string; fields?: unknown } | null>;
  getPrimaryServiceGalleryImages: (limit: number) => Promise<Array<{ id: string; file_url: string; caption?: string | null }>>;
  getDefaultProcessSteps: (kind: 'home' | 'service' | 'serviceArea' | 'about') => unknown[];
  components: {
    AppImage: ComponentType<any>;
    MarkdownLite: ComponentType<any>;
    BlockRenderer: ComponentType<any>;
    PrimaryButton: ComponentType<any>;
    Hero: ComponentType<any>;
    ServiceGridSection: ComponentType<any>;
    ServiceCard: ComponentType<any>;
    TestimonialSection: ComponentType<any>;
    FaqSection: ComponentType<any>;
    ProjectsSection: ComponentType<any>;
    FrontendForm: ComponentType<any>;
    PageHero: ComponentType<any>;
    IconValue: ComponentType<any>;
    BlogPageHero: ComponentType<any>;
    AreaPageHero: ComponentType<any>;
    ServicePageHero: ComponentType<any>;
    BeforeAfterSection: ComponentType<any>;
    GallerySection: ComponentType<any>;
    LogosSection: ComponentType<any>;
    BlogGridSection: ComponentType<any>;
    CalloutQuoteSection: ComponentType<any>;
    ProcessSection: ComponentType<any>;
    OwnerSpotlightSection: ComponentType<any>;
    AreaGridSection: ComponentType<any>;
    TeamGridSection: ComponentType<any>;
  };
}

const NoopComponent: ComponentType<any> = () => null;

export const defaultTemplatePageRendererAdapter: TemplatePageRendererAdapter = {
  getActiveFormById: async () => null,
  getPrimaryServiceGalleryImages: async () => [],
  getDefaultProcessSteps: () => [],
  components: {
    AppImage: NoopComponent,
    MarkdownLite: NoopComponent,
    BlockRenderer: NoopComponent,
    PrimaryButton: NoopComponent,
    Hero: NoopComponent,
    ServiceGridSection: NoopComponent,
    ServiceCard: NoopComponent,
    TestimonialSection: NoopComponent,
    FaqSection: NoopComponent,
    ProjectsSection: NoopComponent,
    FrontendForm: NoopComponent,
    PageHero: NoopComponent,
    IconValue: NoopComponent,
    BlogPageHero: NoopComponent,
    AreaPageHero: NoopComponent,
    ServicePageHero: NoopComponent,
    BeforeAfterSection: NoopComponent,
    GallerySection: NoopComponent,
    LogosSection: NoopComponent,
    BlogGridSection: NoopComponent,
    CalloutQuoteSection: NoopComponent,
    ProcessSection: NoopComponent,
    OwnerSpotlightSection: NoopComponent,
    AreaGridSection: NoopComponent,
    TeamGridSection: NoopComponent,
  },
};

export function toFrontendFormFields(value: unknown): FrontendFormField[] {
  if (!Array.isArray(value)) return [];
  const parsed = value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const row = item as Record<string, unknown>;
      if (typeof row.name !== 'string' || typeof row.label !== 'string' || typeof row.type !== 'string') return null;

      const field: FrontendFormField = {
        id: typeof row.id === 'string' ? row.id : row.name,
        name: row.name,
        label: row.label,
        type: row.type as FrontendFormField['type'],
        placeholder: typeof row.placeholder === 'string' ? row.placeholder : '',
        required: row.required === true,
        helpText: typeof row.helpText === 'string' ? row.helpText : '',
        options: Array.isArray(row.options) ? row.options.filter((option): option is string => typeof option === 'string') : [],
        row: typeof row.row === 'number' && Number.isFinite(row.row) ? Math.max(1, Math.trunc(row.row)) : undefined,
        span:
          typeof row.span === 'number' && Number.isFinite(row.span)
            ? Math.max(1, Math.min(12, Math.trunc(row.span)))
            : undefined,
        enableGoogleMaps: row.type === 'address' ? row.enableGoogleMaps !== false : undefined,
      };
      return field;
    });
  return parsed.filter((field): field is FrontendFormField => field !== null);
}

export function getString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

export function getNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function getObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function interpolateDynamicTags(template: string, context?: TemplatePageRenderContext) {
  const business = context?.business ?? context?.contact?.business ?? null;
  const primaryService =
    context?.services?.find((item) => item.is_primary)?.title ??
    context?.service?.title ??
    '';
  const stateRaw = (business?.state ?? '').trim();
  const stateCode = /^[a-z]{2}$/i.test(stateRaw) ? stateRaw.toUpperCase() : '';
  const domain = (business?.domain ?? '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const tokens: Record<string, string> = {
    business: business?.name ?? '',
    city: business?.city ?? '',
    state: business?.state ?? '',
    state_code: stateCode,
    primary_area: business?.city ?? '',
    primary_service: primaryService,
    parent_service: context?.parentService?.title ?? context?.service?.title ?? '',
    page: context?.page?.title ?? '',
    service: context?.service?.title ?? '',
    area: context?.area?.name ?? '',
    location: context?.area?.name ?? '',
    post: context?.blogPost?.title ?? '',
    blog_post: context?.blogPost?.title ?? '',
    url: context?.url ?? '',
    site_url: domain ? `https://${domain}` : '',
  };

  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => tokens[key] ?? '');
}


