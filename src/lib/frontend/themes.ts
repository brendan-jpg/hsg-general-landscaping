import { join } from 'node:path';

export type FrontendTheme = string;
export const STARTER_THEME_KEY = 'starter-theme-v2';
export const LEGACY_STARTER_THEME_KEY = 'starter-theme';

const FRONTEND_STYLES_DIR = join(process.cwd(), 'src', 'styles', 'frontend');
const STARTER_THEME_FILE_PATH = join(FRONTEND_STYLES_DIR, 'starting themes', 'starter-theme-v2.css');
const LEGACY_STARTER_THEME_FILE_PATH = join(FRONTEND_STYLES_DIR, 'starting themes', 'starter-theme.css');

export function normalizeFrontendTheme(value: unknown): FrontendTheme | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === LEGACY_STARTER_THEME_KEY) return LEGACY_STARTER_THEME_KEY;
  if (normalized === STARTER_THEME_KEY) return STARTER_THEME_KEY;
  if (!/^client-[a-z0-9-]+-theme$/.test(normalized)) return null;
  return normalized;
}

export function buildClientThemeKey(slug: string) {
  const normalizedSlug = String(slug || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  return normalizedSlug ? (`client-${normalizedSlug}-theme` as FrontendTheme) : null;
}

export function getFrontendThemeFromBusiness(business: { theme_key?: string | null; settings?: unknown } | null | undefined): FrontendTheme | null {
  const directTheme = normalizeFrontendTheme(business?.theme_key);
  if (directTheme) return directTheme;
  return null;
}

export function getFrontendThemeFilePath(theme: FrontendTheme) {
  if (theme === LEGACY_STARTER_THEME_KEY) return LEGACY_STARTER_THEME_FILE_PATH;
  return STARTER_THEME_FILE_PATH;
}
