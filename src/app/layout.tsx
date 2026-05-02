import '@/styles/globals.css';
import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { headers } from 'next/headers';
import StructuredData from '@/components/shared/StructuredData';
import { getBusiness, getSeoSettings } from '@/lib/utils/business';
import { buildBaseSchemas } from '@/lib/utils/schema';

const BASE_METADATA: Metadata = {
  title: {
    template: '%s | Site Name',
    default: 'Site Name',
  },
  description: 'Home service business platform',
};

const backendSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-backend-sans',
  display: 'swap',
});

const backendLabel = Inter({
  subsets: ['latin'],
  variable: '--font-backend-label',
  display: 'swap',
});

function getSettingsString(settings: unknown, key: string) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return '';
  const value = (settings as Record<string, unknown>)[key];
  return typeof value === 'string' ? value.trim() : '';
}

function getSupabaseOrigin() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isStandalonePreviewPath(pathname: string) {
  return pathname === '/try-free' || pathname.startsWith('/try-free/');
}

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get('x-hsg-pathname') || '';
  if (pathname === '/try-free' || pathname.startsWith('/try-free/')) {
    return {
      title: 'Try Free',
      description: 'Create a trial home service website.',
    };
  }

  const business = await getBusiness();
  const faviconUrl = getSettingsString(business?.settings, 'favicon_url');
  const businessName = business?.name?.trim() || 'Site Name';
  const defaultDescription =
    business?.city?.trim() && business?.state?.trim()
      ? `${businessName} serving ${business.city.trim()}, ${business.state.trim()}.`
      : BASE_METADATA.description;
  const metadata: Metadata = {
    ...BASE_METADATA,
    title: {
      template: `%s | ${businessName}`,
      default: businessName,
    },
    description: defaultDescription,
  };

  if (!faviconUrl) {
    return metadata;
  }

  return {
    ...metadata,
    icons: {
      icon: [{ url: faviconUrl }],
      shortcut: [{ url: faviconUrl }],
      apple: [{ url: faviconUrl }],
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get('x-hsg-pathname') || '';
  if (isStandalonePreviewPath(pathname)) {
    return (
      <html lang="en">
        <body suppressHydrationWarning className={`${backendSans.variable} ${backendSans.className} ${backendLabel.variable}`}>
          {children}
        </body>
      </html>
    );
  }

  const [business, seoSettings] = await Promise.all([getBusiness(), getSeoSettings()]);
  const supabaseOrigin = getSupabaseOrigin();
  const baseSchemas = buildBaseSchemas({
    business,
    reviewUrl: seoSettings?.google_business_profile_url ?? null,
  });

  return (
    <html lang="en">
      <head>
        {supabaseOrigin ? (
          <>
            <link rel="preconnect" href={supabaseOrigin} crossOrigin="" />
            <link rel="dns-prefetch" href={supabaseOrigin} />
          </>
        ) : null}
      </head>
      <body suppressHydrationWarning>
        <StructuredData data={baseSchemas} />
        {children}
      </body>
    </html>
  );
}
