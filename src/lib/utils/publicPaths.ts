import type { Json } from '@/lib/types/database';

export const DEFAULT_SERVICE_DETAIL_BASE_SEGMENT = 'services';
export const DEFAULT_AREA_DETAIL_BASE_SEGMENT = 'service-areas';

function asSettingsRecord(settings: Json | null | undefined): Record<string, unknown> {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return {};
  return settings as Record<string, unknown>;
}

export function normalizePublicPathSegment(value: string | null | undefined) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getConfiguredDetailBaseSegment(
  settings: Json | null | undefined,
  key: 'service_detail_base_path' | 'area_detail_base_path',
  fallback: string,
) {
  const rawValue = asSettingsRecord(settings)[key];
  const normalized = typeof rawValue === 'string' ? normalizePublicPathSegment(rawValue) : '';
  return normalized || fallback;
}

function normalizeEntitySlug(slug: string) {
  return slug.trim().replace(/^\/+|\/+$/g, '');
}

export function getServiceDetailBaseSegment(settings: Json | null | undefined) {
  return getConfiguredDetailBaseSegment(settings, 'service_detail_base_path', DEFAULT_SERVICE_DETAIL_BASE_SEGMENT);
}

export function getAreaDetailBaseSegment(settings: Json | null | undefined) {
  return getConfiguredDetailBaseSegment(settings, 'area_detail_base_path', DEFAULT_AREA_DETAIL_BASE_SEGMENT);
}

export function buildServicePath(slug: string, settings: Json | null | undefined) {
  return `/${getServiceDetailBaseSegment(settings)}/${normalizeEntitySlug(slug)}`;
}

export function buildAreaPath(slug: string, settings: Json | null | undefined) {
  return `/${getAreaDetailBaseSegment(settings)}/${normalizeEntitySlug(slug)}`;
}

