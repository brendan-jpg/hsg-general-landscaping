import type { ServiceProject } from './frontend/content';
import type { Tables } from './types/database';

type GalleryImage = { id: string; file_url: string; caption?: string | null };
type RuntimeImage = { id: string; file_url: string; caption?: string | null };
type PublicFaq = { id: string; question: string; answer: string };
type Business = {
  id?: string;
  name?: string | null;
  city?: string | null;
  state?: string | null;
  logo_url?: string | null;
  domain?: string | null;
};

export interface SectionsRuntime {
  queries: {
    getPrimaryServiceFeaturedImage: () => Promise<RuntimeImage | null>;
    getPrimaryServiceGalleryImages: (limit: number) => Promise<GalleryImage[]>;
    getGalleryImages: (args?: { serviceId?: string; limit?: number }) => Promise<GalleryImage[]>;
    getPublicFaqs: (args?: {
      global?: boolean;
      pageType?: string;
      pageId?: string;
      serviceId?: string;
    }) => Promise<PublicFaq[]>;
    getPublicMediaImages: (args?: { limit?: number }) => Promise<GalleryImage[]>;
    getActiveServices: () => Promise<Tables<'services'>[]>;
  };
  actions: {
    submitForm: (formData: FormData) => Promise<void>;
  };
  analytics: {
    trackEvent: (event: string) => void;
  };
  business: {
    getBusiness: () => Promise<Business | null>;
  };
  transforms: {
    toStateCode: (value?: string | null) => string;
    toServiceProjects: (projects: ServiceProject[]) => ServiceProject[];
  };
}

const defaultRuntime: SectionsRuntime = {
  queries: {
    getPrimaryServiceFeaturedImage: async () => null,
    getPrimaryServiceGalleryImages: async () => [],
    getGalleryImages: async () => [],
    getPublicFaqs: async () => [],
    getPublicMediaImages: async () => [],
    getActiveServices: async () => [],
  },
  actions: {
    submitForm: async () => {
      throw new Error('submitForm runtime handler not configured');
    },
  },
  analytics: {
    trackEvent: () => {},
  },
  business: {
    getBusiness: async () => null,
  },
  transforms: {
    toStateCode: (value) => {
      const trimmed = (value ?? '').trim();
      return /^[A-Za-z]{2}$/.test(trimmed) ? trimmed.toUpperCase() : '';
    },
    toServiceProjects: (projects) => projects,
  },
};

let runtime: SectionsRuntime = defaultRuntime;

export function setSectionsRuntime(overrides: Partial<SectionsRuntime>) {
  runtime = {
    ...runtime,
    ...overrides,
    queries: { ...runtime.queries, ...overrides.queries },
    actions: { ...runtime.actions, ...overrides.actions },
    analytics: { ...runtime.analytics, ...overrides.analytics },
    business: { ...runtime.business, ...overrides.business },
    transforms: { ...runtime.transforms, ...overrides.transforms },
  };
}

export function getSectionsRuntime() {
  return runtime;
}

