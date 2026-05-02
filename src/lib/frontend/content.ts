export interface ContentBlock {
  type: string;
  data: Record<string, unknown>;
}

export interface ServiceProject {
  title: string;
  summary: string;
  photo_urls: string[];
  area_ids: string[];
}

export interface BeforeAfterGroup {
  before_urls: string[];
  after_urls: string[];
  area_ids: string[];
}

export function toBlocks(content: unknown): ContentBlock[] {
  if (!Array.isArray(content)) return [];

  return content.filter((value): value is ContentBlock => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const block = value as ContentBlock;
    return typeof block.type === 'string' && !!block.data && typeof block.data === 'object';
  });
}

export function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function toServiceProjects(value: unknown): ServiceProject[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const row = item as Record<string, unknown>;
      const title = typeof row.title === 'string' ? row.title.trim() : '';
      const summary = typeof row.summary === 'string' ? row.summary.trim() : '';
      const photo_urls = toStringArray(row.photo_urls);
      const area_ids = toStringArray(row.area_ids);

      if (!title && !summary && photo_urls.length === 0) return null;
      return { title, summary, photo_urls, area_ids };
    })
    .filter((item): item is ServiceProject => Boolean(item));
}

export function toBeforeAfterGroups(value: unknown): BeforeAfterGroup[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const row = item as Record<string, unknown>;
      const before_urls = toStringArray(row.before_urls);
      const after_urls = toStringArray(row.after_urls);
      const area_ids = toStringArray(row.area_ids);

      if (before_urls.length === 0 && after_urls.length === 0) return null;
      return { before_urls, after_urls, area_ids };
    })
    .filter((item): item is BeforeAfterGroup => Boolean(item));
}

export function buildBeforeAfterGroups(beforeAfterGroupsValue: unknown) {
  return toBeforeAfterGroups(beforeAfterGroupsValue);
}
