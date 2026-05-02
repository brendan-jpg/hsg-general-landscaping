import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { AreaGridSection, PageHero } from '@/lib/sections-core/frontend';
import TemplatePageRenderer from '@/components/integrations/TemplatePageRenderer';
import { applyAreaCardExcerptSetting } from '@/lib/frontend/cardExcerpts';
import { toTemplatePageContent } from '@/lib/sections/templatePages';
import { getActiveArchivePagePaths, getActivePageByKind, getActiveAreas } from '@/lib/content/queries';
import { getBusiness } from '@/lib/utils/business';
import { buildDynamicMetadata } from '@/lib/utils/seo';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getActivePageByKind('areas_archive');

  return buildDynamicMetadata({
    titleTemplate: page?.meta_title,
    descriptionTemplate: page?.meta_description,
    fallbackTitle: page?.title || 'Areas We Serve',
    fallbackDescription: page?.meta_description,
    imageUrl: page?.og_image_url,
    pathname: page?.slug ? `/${page.slug}` : '/service-areas',
  });
}

export default async function AreasPage() {
  const [areas, page, archivePaths, business] = await Promise.all([
    getActiveAreas(),
    getActivePageByKind('areas_archive'),
    getActiveArchivePagePaths(),
    getBusiness(),
  ]);
  const areasWithCardExcerpts = applyAreaCardExcerptSetting(areas, business?.settings);
  if (page?.slug && page.slug !== 'service-areas') {
    redirect(`/${page.slug}`);
  }
  const templateContent = toTemplatePageContent(page?.content);
  const hasArchiveBlocks =
    templateContent?.sections.some(
      (section) => ['area_grid_section', 'area_archive_grid_section', 'service_area_grid_section'].includes(section.type),
    ) ?? false;

  return (
    <div className="page page--areas">
      {templateContent && hasArchiveBlocks ? (
        <TemplatePageRenderer
          content={templateContent}
          context={{
            url: archivePaths.areas,
            page: { title: page?.title ?? 'Areas We Serve', metaDescription: page?.meta_description },
            serviceAreas: areas,
            archivePaths,
          }}
        />
      ) : (
        <>
          <PageHero
            heading="Areas We Serve"
            lede="Explore the neighborhoods, cities, and regions we actively service."
            className="areas-archive__hero areas-archive-hero-section"
          />
          {areas.length === 0 ? (
            <p className="services-list__empty">Areas coming soon.</p>
          ) : (
            <AreaGridSection areas={areasWithCardExcerpts} heading="Areas We Serve" />
          )}
        </>
      )}
    </div>
  );
}

