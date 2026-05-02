import type { Tables } from '@/lib/types/database';

type Media = Tables<'media'>;

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function getMediaRoleFromMetadata(metadata: unknown): string | null {
  const root = asObject(metadata);
  if (!root) return null;
  const role = root.role;
  return typeof role === 'string' && role.trim() ? role.trim().toLowerCase() : null;
}

function looksLikeLogoText(value: string | null | undefined) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return /\blogo\b|brand[-_\s]?mark|word[-_\s]?mark/.test(normalized);
}

function looksLikeIconText(value: string | null | undefined) {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return /\bfavicon\b|\bicon\b|app[-_\s]?icon/.test(normalized);
}

export function isLogoMedia(
  item: Pick<Media, 'metadata'> & Partial<Pick<Media, 'file_name' | 'folder' | 'alt_text' | 'file_url'>>,
): boolean {
  if (getMediaRoleFromMetadata(item.metadata) === 'logo') return true;
  if (looksLikeLogoText(item.file_name)) return true;
  if (looksLikeLogoText(item.folder)) return true;
  if (looksLikeLogoText(item.alt_text)) return true;
  if (looksLikeLogoText(item.file_url)) return true;
  return false;
}

export function isIconMedia(
  item: Pick<Media, 'metadata'> & Partial<Pick<Media, 'file_name' | 'folder' | 'alt_text' | 'file_url'>>,
): boolean {
  if (getMediaRoleFromMetadata(item.metadata) === 'icon') return true;
  if (looksLikeIconText(item.file_name)) return true;
  if (looksLikeIconText(item.folder)) return true;
  if (looksLikeIconText(item.alt_text)) return true;
  if (looksLikeIconText(item.file_url)) return true;
  return false;
}
