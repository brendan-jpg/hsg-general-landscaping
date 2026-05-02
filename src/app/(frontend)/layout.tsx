import { cache } from 'react';
import { Fraunces, Montserrat, Plus_Jakarta_Sans } from 'next/font/google';
import { notFound } from 'next/navigation';
import Script from 'next/script';
import Header from '@/components/frontend/Header';
import Footer from '@/components/frontend/Footer';
import AutoGridRuntime from '@/components/frontend/AutoGridRuntime';
import TrialExplorePrompt from '@/components/frontend/TrialExplorePrompt';
import NativeAnalytics from '@/components/analytics/NativeAnalytics';
import { getActiveAreas, getActiveSystemPageHrefs } from '@/lib/content/queries';
import { getFrontendThemeFromBusiness, STARTER_THEME_KEY, normalizeFrontendTheme } from '@/lib/frontend/themes';
import { buildHeaderNavRenderItems, parseHeaderNavConfigFromBusinessSettings } from '@/lib/navigation/headerNavigation';
import SectionsRuntimeClientSetup from '@/lib/sections/runtime.client';
import { initializeSectionsServerRuntime } from '@/lib/sections/runtime.server';
import { getActiveServices } from '@/lib/services/queries';
import { getBusiness, getSeoSettings } from '@/lib/utils/business';

const bodyFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-client-sans',
  display: 'swap',
});

const displayFont = Fraunces({
  subsets: ['latin'],
  variable: '--font-client-display',
  display: 'swap',
});

const heroTitleFont = Montserrat({
  subsets: ['latin'],
  variable: '--font-client-hero',
  display: 'swap',
});

const configuredTheme = normalizeFrontendTheme(process.env.FRONTEND_THEME || process.env.NEXT_PUBLIC_FRONTEND_THEME);

function normalizeAnalyticsId(value: string | null | undefined) {
  const normalized = value?.trim() ?? '';
  return normalized || null;
}

function renderGoogleAnalyticsScripts(analyticsId: string) {
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(analyticsId)}`} strategy="afterInteractive" />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${analyticsId}');
          `,
        }}
      />
    </>
  );
}

function renderGoogleTagManagerScripts(containerId: string) {
  return (
    <>
      <Script
        id="google-tag-manager"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','${containerId}');
          `,
        }}
      />
    </>
  );
}

const getFrontendLayoutData = cache(async () => {
  const [business, seoSettings, services, Areas, systemPageHrefs] = await Promise.all([
    getBusiness(),
    getSeoSettings(),
    getActiveServices(),
    getActiveAreas(),
    getActiveSystemPageHrefs(),
  ]);
  const headerNavConfig = parseHeaderNavConfigFromBusinessSettings(business?.settings);
  const headerNavItems = buildHeaderNavRenderItems(headerNavConfig, services, Areas, business?.settings, systemPageHrefs);
  const frontendTheme = getFrontendThemeFromBusiness(business) ?? configuredTheme ?? STARTER_THEME_KEY;
  return {
    business,
    headerNavItems,
    frontendTheme,
    googleAnalyticsId: normalizeAnalyticsId(seoSettings?.google_analytics_id),
    googleTagManagerId: normalizeAnalyticsId(seoSettings?.google_tag_manager_id),
  };
});

export default async function FrontendLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  initializeSectionsServerRuntime();
  const { business, headerNavItems, frontendTheme, googleAnalyticsId, googleTagManagerId } = await getFrontendLayoutData();
  if (!business) notFound();

  return (
    <>
      {googleAnalyticsId ? renderGoogleAnalyticsScripts(googleAnalyticsId) : null}
      {googleTagManagerId ? renderGoogleTagManagerScripts(googleTagManagerId) : null}
      <link rel="stylesheet" href={`/theme.css?theme=${encodeURIComponent(frontendTheme)}&businessId=${encodeURIComponent(business.id)}`} />
      {googleTagManagerId ? (
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(googleTagManagerId)}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
      ) : null}
      <div className={`site ${bodyFont.variable} ${displayFont.variable} ${heroTitleFont.variable}`} data-theme={frontendTheme}>
        <SectionsRuntimeClientSetup />
        <AutoGridRuntime />
        <NativeAnalytics />
        <TrialExplorePrompt />
        <Header businessName={business?.name ?? null} logoUrl={business?.logo_url ?? null} navItems={headerNavItems} />
        <main className="site__main">{children}</main>
        <Footer />
      </div>
    </>
  );
}
