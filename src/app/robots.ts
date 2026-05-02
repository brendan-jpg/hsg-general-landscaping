import type { MetadataRoute } from 'next';
import { getResolvedBusinessDomain } from '@/lib/utils/business';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const businessDomain = await getResolvedBusinessDomain();
  const sitemap = businessDomain
    ? `https://${businessDomain}/sitemap.xml`
    : undefined;

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard/', '/api/', '/login'],
      },
    ],
    sitemap,
  };
}
