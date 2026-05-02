import { getRequiredDashboardPageByKind, type PageKind } from '@/lib/content/pageConfig';

export interface TemplateOption {
  key: string;
  label: string;
}

export const PAGE_TEMPLATE_OPTIONS: TemplateOption[] = [
  { key: 'home-page-v1', label: 'Home' },
  { key: 'content-page-v1', label: 'Standard Content' },
  { key: 'services-archive-page-v1', label: 'Services Archive' },
  { key: 'service-content-v1', label: 'Service Single' },
  { key: 'areas-archive-page-v1', label: 'Areas Archive' },
  { key: 'area-content-v1', label: 'Area Single' },
  { key: 'about-page-v1', label: 'About' },
  { key: 'blog-archive-page-v1', label: 'Blog Archive' },
  { key: 'blog-post-content-v1', label: 'Blog Post' },
  { key: 'contact-page-v1', label: 'Contact' },
];

export const SERVICE_TEMPLATE_OPTIONS: TemplateOption[] = PAGE_TEMPLATE_OPTIONS;

export const AREA_TEMPLATE_OPTIONS: TemplateOption[] = PAGE_TEMPLATE_OPTIONS;

export function getRecommendedPageTemplateKeyForPageKind(pageKind: PageKind | null | undefined) {
  return getRequiredDashboardPageByKind(pageKind)?.templateKey ?? 'content-page-v1';
}

export function getRecommendedPageTemplateKeyForSlug(slugValue: string | null | undefined) {
  if (slugValue === 'home') return 'home-page-v1';
  if (slugValue === 'services') return 'services-archive-page-v1';
  if (slugValue === 'about') return 'about-page-v1';
  if (slugValue === 'contact') return 'contact-page-v1';
  if (slugValue === 'blog') return 'blog-archive-page-v1';
  if (slugValue === 'service-areas') return 'areas-archive-page-v1';
  return 'content-page-v1';
}

export function isAllowedPageTemplateKey(templateKey: string) {
  return PAGE_TEMPLATE_OPTIONS.some((option) => option.key === templateKey);
}

export function isAllowedServiceTemplateKey(templateKey: string) {
  return SERVICE_TEMPLATE_OPTIONS.some((option) => option.key === templateKey);
}

export function isAllowedAreaTemplateKey(templateKey: string) {
  return AREA_TEMPLATE_OPTIONS.some((option) => option.key === templateKey);
}
