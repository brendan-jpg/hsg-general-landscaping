import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import TemplatePageRenderer from '@/components/integrations/TemplatePageRenderer';
import { createTemplatePageContent, toTemplatePageContent } from '@/lib/sections/templatePages';
import { getActiveArchivePagePaths, getActivePageByKind } from '@/lib/content/queries';
import { getActiveServices } from '@/lib/services/queries';
import { buildDynamicMetadata } from '@/lib/utils/seo';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getActivePageByKind('services_archive');

  return buildDynamicMetadata({
    titleTemplate: page?.meta_title,
    descriptionTemplate: page?.meta_description,
    fallbackTitle: page?.title || 'Our Services',
    fallbackDescription: page?.meta_description,
    imageUrl: page?.og_image_url,
    pathname: page?.slug ? `/${page.slug}` : '/services',
  });
}

export default async function ServicesPage() {
  const [services, page, archivePaths] = await Promise.all([
    getActiveServices(),
    getActivePageByKind('services_archive'),
    getActiveArchivePagePaths(),
  ]);
  if (page?.slug && page.slug !== 'services') {
    redirect(`/${page.slug}`);
  }
  const templateContent = toTemplatePageContent(page?.content) ?? createTemplatePageContent('services-archive-page-v1');

  return (
    <div className="page page--services">
      <TemplatePageRenderer
        content={templateContent}
        context={{
          url: archivePaths.services,
          page: { title: page?.title ?? 'Our Services', metaDescription: page?.meta_description },
          services,
          archivePaths,
        }}
      />
    </div>
  );
}




