import Link from 'next/link';
import ThemeCssEditor from '@/components/backend/ThemeCssEditor';
import { savePlatformThemeFileAction } from '@/lib/actions';
import { requirePlatformAdminDashboardPage } from '@/lib/authz/dashboard';
import { getFrontendThemeEditorBaseSourceForTheme } from '@/lib/frontend/themeCss';
import { buildClientThemeKey, getFrontendThemeFromBusiness, STARTER_THEME_KEY } from '@/lib/frontend/themes';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Tables } from '@/lib/types/database';

type PlatformThemeEditorPageProps = {
  searchParams?: Promise<{
    client?: string;
  }>;
};

type TenantRow = Pick<Tables<'businesses'>, 'id' | 'name' | 'slug' | 'settings' | 'theme_key' | 'theme_css'>;

export default async function PlatformThemeEditorPage({ searchParams }: PlatformThemeEditorPageProps) {
  await requirePlatformAdminDashboardPage();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedClientId = resolvedSearchParams?.client?.trim() ?? '';
  const admin = createAdminClient();

  const { data: tenantsData, error: tenantsError } = await admin
    .from('businesses')
    .select('id,name,slug,settings,theme_key,theme_css')
    .order('created_at', { ascending: false });
  if (tenantsError) throw new Error(tenantsError.message);

  const tenants = (tenantsData ?? []) as TenantRow[];
  const selectedTenant =
    tenants.find((tenant) => tenant.id === requestedClientId) ??
    tenants[0] ??
    null;

  if (!selectedTenant) {
    return (
      <main className="platform-theme-standalone">
        <div className="platform-theme-editor-page platform-theme-editor-page--empty">
          <p className="platform-empty">Create a client first, then open the theme editor.</p>
          <Link className="btn btn--secondary" href="/dashboard/platform">
            Back To Platform
          </Link>
        </div>
      </main>
    );
  }

  const activeThemeKey = getFrontendThemeFromBusiness(selectedTenant) ?? buildClientThemeKey(selectedTenant.slug) ?? STARTER_THEME_KEY;
  const baseThemeCss = await getFrontendThemeEditorBaseSourceForTheme(activeThemeKey);
  const storedThemeCss = typeof selectedTenant.theme_css === 'string' ? selectedTenant.theme_css.trim() : '';
  const activeThemeCss = storedThemeCss || baseThemeCss;

  return (
    <main className="platform-theme-standalone">
      <div className="platform-theme-editor-page">
        <ThemeCssEditor
          action={savePlatformThemeFileAction}
          businessId={selectedTenant.id}
          themeKey={activeThemeKey}
          initialCss={activeThemeCss}
          baseCss={baseThemeCss}
          isUsingStoredCopy={Boolean(storedThemeCss)}
          backHref={`/dashboard/platform?client=${encodeURIComponent(selectedTenant.id)}`}
          siteHref="/"
        />
      </div>
    </main>
  );
}
