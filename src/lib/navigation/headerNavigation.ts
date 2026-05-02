import type { Json, Tables } from '@/lib/types/database';
import { buildAreaPath, buildServicePath } from '@/lib/utils/publicPaths';

type Service = Tables<'services'>;
type Area = Tables<'areas'>;

export type HeaderNavItemStyle = 'link' | 'cta';
export type HeaderNavChildrenSource = 'none' | 'services' | 'areas' | 'service_children' | 'service_groups';
export type HeaderNavMenuStyle = 'dropdown' | 'mega';

export interface HeaderNavConfigItem {
  id: string;
  label: string;
  href: string;
  sourcePageSlug: string | null;
  isVisible: boolean;
  style: HeaderNavItemStyle;
  childrenSource: HeaderNavChildrenSource;
  sourceServiceId: string | null;
  sourceServiceIds: string[];
  menuStyle: HeaderNavMenuStyle;
  children: HeaderNavConfigItem[];
}

export interface HeaderNavConfig {
  items: HeaderNavConfigItem[];
}

export interface HeaderNavRenderItem {
  id: string;
  label: string;
  href: string;
  style: HeaderNavItemStyle;
  menuStyle?: HeaderNavMenuStyle;
  children: HeaderNavRenderItem[];
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function normalizeLegacyAreaHref(href: string) {
  const normalizedHref = href.trim();
  if (normalizedHref === '/areas') return '/service-areas';
  if (normalizedHref.startsWith('/areas/')) return `/service-areas/${normalizedHref.slice('/areas/'.length)}`;
  return normalizedHref;
}

function ensureId(value: unknown, fallbackPrefix = 'nav') {
  const next = asString(value).trim();
  if (next) return next;
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return `${fallbackPrefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${fallbackPrefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createDefaultHeaderNavConfig(): HeaderNavConfig {
  return {
    items: [
      createHeaderNavItem({ label: 'Home', href: '/', sourcePageSlug: 'home' }),
      createHeaderNavItem({
        label: 'Our Services',
        href: '/services',
        sourcePageSlug: 'services',
        childrenSource: 'services',
        menuStyle: 'mega',
      }),
      createHeaderNavItem({
        label: 'Areas We Serve',
        href: '/service-areas',
        sourcePageSlug: 'service-areas',
        childrenSource: 'areas',
      }),
      createHeaderNavItem({ label: 'About', href: '/about', sourcePageSlug: 'about' }),
      createHeaderNavItem({ label: 'Blog', href: '/blog', sourcePageSlug: 'blog' }),
      createHeaderNavItem({ label: 'Contact', href: '/contact', sourcePageSlug: 'contact' }),
    ],
  };
}

export function createHeaderNavItem(partial?: Partial<HeaderNavConfigItem>): HeaderNavConfigItem {
  const normalizedSourceServiceIds = Array.isArray(partial?.sourceServiceIds)
    ? partial.sourceServiceIds.map((value) => value.trim()).filter(Boolean)
    : [];

  return {
    id: partial?.id?.trim() || ensureId(undefined),
    label: partial?.label?.trim() || '',
    href: partial?.href?.trim() || '',
    sourcePageSlug: partial?.sourcePageSlug?.trim() || null,
    isVisible: true,
    style: partial?.style === 'cta' ? 'cta' : 'link',
    childrenSource:
      partial?.childrenSource === 'services' ||
      partial?.childrenSource === 'areas' ||
      partial?.childrenSource === 'service_children' ||
      partial?.childrenSource === 'service_groups'
        ? partial.childrenSource
        : 'none',
    sourceServiceId: partial?.sourceServiceId?.trim() || null,
    sourceServiceIds: normalizedSourceServiceIds,
    menuStyle: partial?.menuStyle === 'mega' ? 'mega' : 'dropdown',
    children: Array.isArray(partial?.children) ? partial.children : [],
  };
}

function sanitizeHeaderNavItem(input: unknown, depth = 0): HeaderNavConfigItem | null {
  const obj = asObject(input);
  const label = asString(obj.label).trim();
  const rawHref = asString(obj.href).trim();
  const rawSourcePageSlug = asString(obj.sourcePageSlug).trim();
  const sourcePageSlug = rawSourcePageSlug === 'areas' ? 'service-areas' : rawSourcePageSlug || null;
  const href = normalizeLegacyAreaHref(rawHref);
  const sourceRaw = asString(obj.childrenSource).trim();
  const childrenSource: HeaderNavChildrenSource =
    sourceRaw === 'services' ||
    sourceRaw === 'areas' ||
    sourceRaw === 'service_children' ||
    sourceRaw === 'service_groups'
      ? sourceRaw
      : 'none';
  const menuStyle: HeaderNavMenuStyle = asString(obj.menuStyle).trim() === 'mega' ? 'mega' : 'dropdown';
  const style: HeaderNavItemStyle = asString(obj.style).trim() === 'cta' ? 'cta' : 'link';
  const sourceServiceIds = asArray(obj.sourceServiceIds)
    .map((value) => asString(value).trim())
    .filter(Boolean);

  const childItems =
    depth >= 2
      ? []
      : asArray(obj.children)
          .map((child) => sanitizeHeaderNavItem(child, depth + 1))
          .filter((child): child is HeaderNavConfigItem => Boolean(child));

  if (!label && !href && !sourcePageSlug && childrenSource === 'none' && childItems.length === 0) return null;

  return {
    id: ensureId(obj.id),
    label,
    href,
    sourcePageSlug,
    isVisible: true,
    style,
    childrenSource,
    sourceServiceId: asString(obj.sourceServiceId).trim() || null,
    sourceServiceIds,
    menuStyle,
    children: childItems,
  };
}

export function parseHeaderNavConfig(input: unknown): HeaderNavConfig {
  const root = asObject(input);
  const parsedItems = asArray(root.items)
    .map((item) => sanitizeHeaderNavItem(item))
    .filter((item): item is HeaderNavConfigItem => Boolean(item));

  return parsedItems.length > 0 ? { items: parsedItems } : createDefaultHeaderNavConfig();
}

export function parseHeaderNavConfigFromBusinessSettings(settings: Json | null | undefined): HeaderNavConfig {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return createDefaultHeaderNavConfig();
  }
  const root = settings as Record<string, unknown>;
  return parseHeaderNavConfig(root.header_navigation);
}

export function headerNavConfigToJson(config: HeaderNavConfig): Json {
  const normalized = parseHeaderNavConfig(config) as unknown as Json;
  return normalized;
}

function makeServiceLink(service: Service): HeaderNavRenderItem {
  return {
    id: `service-${service.id}`,
    label: service.title || 'Service',
    href: buildServicePath(service.slug ?? '', null),
    style: 'link',
    children: [],
  };
}

function makeAreaLink(area: Area): HeaderNavRenderItem {
  return {
    id: `area-${area.id}`,
    label: area.name || 'Area',
    href: buildAreaPath(area.slug ?? '', null),
    style: 'link',
    children: [],
  };
}

function sortRenderItemsByLabel(items: HeaderNavRenderItem[]): HeaderNavRenderItem[] {
  return [...items].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, {
      sensitivity: 'base',
      numeric: true,
    }),
  );
}

function normalizeManualHref(
  href: string,
  services: Service[],
  Areas: Area[],
  businessSettings: Json | null | undefined,
  systemPageHrefs: Partial<Record<string, string>>,
) {
  const trimmedHref = normalizeLegacyAreaHref(href.trim());
  if (!trimmedHref) return '';
  if (!trimmedHref.startsWith('/')) return trimmedHref;
  if (trimmedHref === '/') return trimmedHref;

  const systemHrefSet = new Set(
    Object.values(systemPageHrefs)
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => normalizeLegacyAreaHref(value.trim())),
  );
  if (systemHrefSet.has(trimmedHref)) return trimmedHref;

  if (trimmedHref.startsWith('/services/') || trimmedHref.startsWith('/service-areas/')) return trimmedHref;

  const slug = trimmedHref.slice(1).trim().toLowerCase();
  if (!slug || slug.includes('/')) return trimmedHref;

  const matchingService = services.find((service) => (service.slug ?? '').trim().toLowerCase() === slug);
  if (matchingService?.slug) return buildServicePath(matchingService.slug, businessSettings);

  const matchingArea = Areas.find((area) => (area.slug ?? '').trim().toLowerCase() === slug);
  if (matchingArea?.slug) return buildAreaPath(matchingArea.slug, businessSettings);

  return trimmedHref;
}

function buildDynamicChildren(
  item: HeaderNavConfigItem,
  services: Service[],
  Areas: Area[],
  businessSettings: Json | null | undefined,
): HeaderNavRenderItem[] {
  if (item.childrenSource === 'areas') {
    return Areas.map((area) => ({
      ...makeAreaLink(area),
      href: buildAreaPath(area.slug ?? '', businessSettings),
    }));
  }

  if (item.childrenSource === 'service_children') {
    if (!item.sourceServiceId) return [];
    return services
      .filter((service) => service.parent_service_id === item.sourceServiceId)
      .map((service) => ({
        ...makeServiceLink(service),
        href: buildServicePath(service.slug ?? '', businessSettings),
      }));
  }

  if (item.childrenSource === 'service_groups') {
    const selectedParentIds = (item.sourceServiceIds ?? []).filter(Boolean);
    if (selectedParentIds.length === 0) return [];
    const selectedParentIdSet = new Set(selectedParentIds);

    const childrenByParent = new Map<string, Service[]>();
    for (const service of services) {
      if (!service.parent_service_id) continue;
      const key = service.parent_service_id;
      const list = childrenByParent.get(key) ?? [];
      list.push(service);
      childrenByParent.set(key, list);
    }

    const parentById = new Map(
      services
        .filter((service) => !service.parent_service_id && selectedParentIdSet.has(service.id))
        .map((service) => [service.id, service]),
    );

    // Preserve the exact column order selected in the nav builder.
    return selectedParentIds
      .map((id) => parentById.get(id))
      .filter((parent): parent is Service => Boolean(parent))
      .map((parent) => ({
        ...makeServiceLink(parent),
        href: buildServicePath(parent.slug ?? '', businessSettings),
        children: (childrenByParent.get(parent.id) ?? []).map((service) => ({
          ...makeServiceLink(service),
          href: buildServicePath(service.slug ?? '', businessSettings),
        })),
      }));
  }

  if (item.childrenSource === 'services') {
    const parents = services.filter((service) => !service.parent_service_id);
    const childrenByParent = new Map<string, Service[]>();
    for (const service of services) {
      if (!service.parent_service_id) continue;
      const key = service.parent_service_id;
      const list = childrenByParent.get(key) ?? [];
      list.push(service);
      childrenByParent.set(key, list);
    }

    if (item.menuStyle === 'mega' && parents.length > 0) {
      return parents.map((parent) => ({
        ...makeServiceLink(parent),
        href: buildServicePath(parent.slug ?? '', businessSettings),
        children: (childrenByParent.get(parent.id) ?? []).map((service) => ({
          ...makeServiceLink(service),
          href: buildServicePath(service.slug ?? '', businessSettings),
        })),
      }));
    }

    const flatParents = parents.map((service) => ({
      ...makeServiceLink(service),
      href: buildServicePath(service.slug ?? '', businessSettings),
    }));
    const orphanChildren = services
      .filter((service) => !!service.parent_service_id)
      .map((service) => ({
        ...makeServiceLink(service),
        href: buildServicePath(service.slug ?? '', businessSettings),
      }));
    return [...flatParents, ...orphanChildren];
  }

  return [];
}

function buildRenderItem(
  item: HeaderNavConfigItem,
  services: Service[],
  Areas: Area[],
  businessSettings: Json | null | undefined,
  systemPageHrefs: Partial<Record<string, string>>,
  depth = 0
): HeaderNavRenderItem | null {
  const manualChildren =
    depth >= 2
      ? []
      : item.children
          .map((child) => buildRenderItem(child, services, Areas, businessSettings, systemPageHrefs, depth + 1))
          .filter((child): child is HeaderNavRenderItem => Boolean(child));
  const dynamicChildren = buildDynamicChildren(item, services, Areas, businessSettings);
  const children = sortRenderItemsByLabel([...manualChildren, ...dynamicChildren]).map((child) => ({
    ...child,
    children: sortRenderItemsByLabel(child.children),
  }));

  const sourceParentService =
    item.childrenSource === 'service_children' && item.sourceServiceId
      ? services.find((service) => service.id === item.sourceServiceId) ?? null
      : null;

  const pageHref =
    item.sourcePageSlug === 'home'
      ? '/'
      : item.sourcePageSlug
        ? systemPageHrefs[item.sourcePageSlug] ?? `/${item.sourcePageSlug}`
        : '';

  const label = item.label.trim();
  const resolvedHref =
    sourceParentService?.slug
      ? buildServicePath(sourceParentService.slug, businessSettings)
      : pageHref || normalizeManualHref(item.href, services, Areas, businessSettings, systemPageHrefs);
  const href = children.length > 0 && !resolvedHref ? '' : resolvedHref || '#';

  if (!label && children.length === 0) return null;

  return {
    id: item.id,
    label: label || sourceParentService?.title || 'Menu Item',
    href,
    style: item.style,
    menuStyle: children.length > 0 ? (item.childrenSource === 'service_groups' ? 'mega' : item.menuStyle) : undefined,
    children,
  };
}

export function buildHeaderNavRenderItems(
  config: HeaderNavConfig,
  services: Service[],
  Areas: Area[],
  businessSettings: Json | null | undefined,
  systemPageHrefs: Partial<Record<string, string>> = {}
): HeaderNavRenderItem[] {
  return config.items
    .map((item) => buildRenderItem(item, services, Areas, businessSettings, systemPageHrefs))
    .filter((item): item is HeaderNavRenderItem => Boolean(item));
}
