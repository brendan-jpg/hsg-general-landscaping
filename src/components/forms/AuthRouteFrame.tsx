import { Fraunces, Montserrat, Plus_Jakarta_Sans } from 'next/font/google';
import { getBusiness } from '@/lib/utils/business';
import { getFrontendThemeFromBusiness, STARTER_THEME_KEY, normalizeFrontendTheme } from '@/lib/frontend/themes';

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

export default async function AuthRouteFrame({
  children,
}: {
  children: React.ReactNode;
}) {
  const business = await getBusiness();
  const frontendTheme = getFrontendThemeFromBusiness(business) ?? configuredTheme ?? STARTER_THEME_KEY;

  return (
    <>
      <link rel="stylesheet" href={`/theme.css?theme=${encodeURIComponent(frontendTheme)}${business?.id ? `&businessId=${encodeURIComponent(business.id)}` : ''}`} />
      <div
        className={`site ${bodyFont.variable} ${displayFont.variable} ${heroTitleFont.variable}`}
        data-theme={frontendTheme}
      >
        {children}
      </div>
    </>
  );
}
