import type { Json } from '@/lib/types/database';

export type FooterColumnItemType = 'text' | 'links' | 'media';

export interface FooterLinkItem {
  id: string;
  label: string;
  href: string;
  sourcePageSlug: string | null;
}

export interface FooterTextItem {
  id: string;
  type: 'text';
  heading: string;
  body: string;
}

export interface FooterLinksItem {
  id: string;
  type: 'links';
  heading: string;
  links: FooterLinkItem[];
}

export interface FooterMediaItem {
  id: string;
  type: 'media';
  heading: string;
  images: string[];
}

export type FooterColumnItem = FooterTextItem | FooterLinksItem | FooterMediaItem;

export interface FooterColumn {
  id: string;
  title: string;
  items: FooterColumnItem[];
}

export interface FooterBuilderConfig {
  columns: FooterColumn[];
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

function ensureId(value: unknown, fallbackPrefix = 'footer') {
  const next = asString(value).trim();
  if (next) return next;
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return `${fallbackPrefix}-${globalThis.crypto.randomUUID()}`;
  }
  return `${fallbackPrefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createFooterLinkItem(partial?: Partial<FooterLinkItem>): FooterLinkItem {
  return {
    id: partial?.id?.trim() || ensureId(undefined, 'footer-link'),
    label: partial?.label?.trim() || '',
    href: partial?.href?.trim() || '',
    sourcePageSlug: partial?.sourcePageSlug?.trim() || null,
  };
}

export function createFooterColumnItem(type: FooterColumnItemType, partial?: Partial<FooterColumnItem>): FooterColumnItem {
  if (type === 'links') {
    const item = partial as Partial<FooterLinksItem> | undefined;
    return {
      id: item?.id?.trim() || ensureId(undefined, 'footer-item'),
      type: 'links',
      heading: item?.heading?.trim() || '',
      links: Array.isArray(item?.links) ? item.links.map((link) => createFooterLinkItem(link)) : [],
    };
  }

  if (type === 'media') {
    const item = partial as Partial<FooterMediaItem> | undefined;
    return {
      id: item?.id?.trim() || ensureId(undefined, 'footer-item'),
      type: 'media',
      heading: item?.heading?.trim() || '',
      images: Array.isArray(item?.images)
        ? item.images.map((value) => (typeof value === 'string' ? value.trim() : '')).filter(Boolean).slice(0, 2)
        : [],
    };
  }

  const item = partial as Partial<FooterTextItem> | undefined;
  return {
    id: item?.id?.trim() || ensureId(undefined, 'footer-item'),
    type: 'text',
    heading: item?.heading?.trim() || '',
    body: item?.body?.trim() || '',
  };
}

export function createFooterColumn(partial?: Partial<FooterColumn>): FooterColumn {
  return {
    id: partial?.id?.trim() || ensureId(undefined, 'footer-column'),
    title: partial?.title?.trim() || '',
    items: Array.isArray(partial?.items)
      ? partial.items.map((item) => createFooterColumnItem(item.type, item))
      : [],
  };
}

export function createDefaultFooterBuilderConfig(): FooterBuilderConfig {
  return {
    columns: [
      createFooterColumn({
        title: 'Brand',
        items: [
          createFooterColumnItem('text', {
            heading: 'About',
            body: 'Add a short description, trust message, or service summary for the footer.',
          }),
        ],
      }),
      createFooterColumn({
        title: 'Quick Links',
        items: [
          createFooterColumnItem('links', {
            heading: 'Browse',
            links: [
              createFooterLinkItem({ label: 'Home', href: '/', sourcePageSlug: 'home' }),
              createFooterLinkItem({ label: 'Services', href: '/services', sourcePageSlug: 'services' }),
              createFooterLinkItem({ label: 'Contact', href: '/contact', sourcePageSlug: 'contact' }),
            ],
          }),
        ],
      }),
      createFooterColumn({
        title: 'Media',
        items: [
          createFooterColumnItem('media', {
            heading: 'Gallery',
            images: [],
          }),
        ],
      }),
    ],
  };
}

function sanitizeFooterLinkItem(input: unknown): FooterLinkItem | null {
  const obj = asObject(input);
  const label = asString(obj.label).trim();
  const href = asString(obj.href).trim();
  const sourcePageSlug = asString(obj.sourcePageSlug).trim() || null;
  if (!label && !href && !sourcePageSlug) return null;
  return {
    id: ensureId(obj.id, 'footer-link'),
    label,
    href,
    sourcePageSlug,
  };
}

function sanitizeFooterColumnItem(input: unknown): FooterColumnItem | null {
  const obj = asObject(input);
  const typeRaw = asString(obj.type).trim();
  const heading = asString(obj.heading).trim();

  if (typeRaw === 'links') {
    const links = asArray(obj.links)
      .map((link) => sanitizeFooterLinkItem(link))
      .filter((link): link is FooterLinkItem => Boolean(link));
    if (!heading && links.length === 0) return null;
    return {
      id: ensureId(obj.id, 'footer-item'),
      type: 'links',
      heading,
      links,
    };
  }

  if (typeRaw === 'media') {
    const images = asArray(obj.images)
      .map((value) => asString(value).trim())
      .filter(Boolean)
      .slice(0, 2);
    if (!heading && images.length === 0) return null;
    return {
      id: ensureId(obj.id, 'footer-item'),
      type: 'media',
      heading,
      images,
    };
  }

  const body = asString(obj.body).trim();
  if (!heading && !body) return null;
  return {
    id: ensureId(obj.id, 'footer-item'),
    type: 'text',
    heading,
    body,
  };
}

function sanitizeFooterColumn(input: unknown): FooterColumn | null {
  const obj = asObject(input);
  const title = asString(obj.title).trim();
  const items = asArray(obj.items)
    .map((item) => sanitizeFooterColumnItem(item))
    .filter((item): item is FooterColumnItem => Boolean(item));
  if (!title && items.length === 0) return null;
  return {
    id: ensureId(obj.id, 'footer-column'),
    title,
    items,
  };
}

export function parseFooterBuilderConfig(input: unknown): FooterBuilderConfig {
  const root = asObject(input);
  const columns = asArray(root.columns)
    .map((column) => sanitizeFooterColumn(column))
    .filter((column): column is FooterColumn => Boolean(column));

  return columns.length > 0 ? { columns } : createDefaultFooterBuilderConfig();
}

export function parseFooterBuilderConfigFromBusinessSettings(settings: Json | null | undefined): FooterBuilderConfig | null {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return null;
  const root = settings as Record<string, unknown>;
  if (!root.footer_builder) return null;
  return parseFooterBuilderConfig(root.footer_builder);
}

export function footerBuilderConfigToJson(config: FooterBuilderConfig): Json {
  return parseFooterBuilderConfig(config) as unknown as Json;
}
