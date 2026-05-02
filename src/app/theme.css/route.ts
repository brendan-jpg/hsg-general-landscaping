import { NextResponse } from 'next/server';
import { compileFrontendThemeSource, getFrontendThemeCss, wrapThemeEditorSource } from '@/lib/frontend/themeCss';
import { STARTER_THEME_KEY, normalizeFrontendTheme } from '@/lib/frontend/themes';
import { createPublicClient } from '@/lib/supabase/server';

async function getBusinessThemeSource(businessId: string) {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('businesses')
    .select('theme_key, theme_css')
    .eq('id', businessId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return {
    themeKey: normalizeFrontendTheme(data?.theme_key) ?? STARTER_THEME_KEY,
    themeCss: typeof data?.theme_css === 'string' ? data.theme_css : '',
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedTheme = normalizeFrontendTheme(searchParams.get('theme')) ?? STARTER_THEME_KEY;
  const businessId = (searchParams.get('businessId') || '').trim();

  if (businessId) {
    const { themeKey, themeCss } = await getBusinessThemeSource(businessId);
    const activeTheme = themeKey || requestedTheme;
    if (themeCss.trim()) {
      const css = compileFrontendThemeSource(wrapThemeEditorSource(activeTheme, themeCss));
      return new NextResponse(css, {
        headers: {
          'Content-Type': 'text/css; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    const css = await getFrontendThemeCss(activeTheme);
    return new NextResponse(css, {
      headers: {
        'Content-Type': 'text/css; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  }

  const css = await getFrontendThemeCss(requestedTheme);
  return new NextResponse(css, {
    headers: {
      'Content-Type': 'text/css; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
}
