import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { PageHero } from '@/lib/sections-core/frontend';
import BlockRenderer from '@/components/shared/BlockRenderer';
import StructuredData from '@/components/shared/StructuredData';
import TemplatePageRenderer from '@/components/integrations/TemplatePageRenderer';
import { toTemplatePageContent } from '@/lib/sections/templatePages';
import { getActiveArchivePagePaths, getActiveAreas, getActivePageBySlug } from '@/lib/content/queries';
import { renderContactPageContent } from '@/lib/frontend/contactPage';
import { generateAreaDetailMetadataBySlug, generateServiceDetailMetadataBySlug, renderAreaDetailPageBySlug, renderServiceDetailPageBySlug } from '@/lib/frontend/detailPages';
import { toBlocks } from '@/lib/frontend/content';
import { getActiveServices } from '@/lib/services/queries';
import { getBusiness } from '@/lib/utils/business';
import { getAreaDetailBaseSegment, getServiceDetailBaseSegment } from '@/lib/utils/publicPaths';
import { buildWebPageSchema } from '@/lib/utils/schema';
import { buildDynamicMetadata } from '@/lib/utils/seo';

interface Props {
  params: Promise<{ slug: string[] }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  if (slug.length === 1) {
    const page = await getActivePageBySlug(slug[0]);
    if (page) {
      return buildDynamicMetadata({
        titleTemplate: page.meta_title,
        descriptionTemplate: page.meta_description,
        fallbackTitle: page.title,
        pathname: `/${page.slug}`,
        tokens: {
          page: page.title,
        },
      });
    }
  }

  if (slug.length === 2) {
    const business = await getBusiness();
    const baseSegment = slug[0]?.trim().toLowerCase() ?? '';
    if (baseSegment === getServiceDetailBaseSegment(business?.settings)) {
      return generateServiceDetailMetadataBySlug(slug[1] ?? '');
    }
    if (baseSegment === getAreaDetailBaseSegment(business?.settings)) {
      return generateAreaDetailMetadataBySlug(slug[1] ?? '');
    }
  }

  return {};
}

export default async function DynamicFrontendPage({ params }: Props) {
  const { slug } = await params;

  if (slug.length === 1) {
    const page = await getActivePageBySlug(slug[0]);
    if (page) {
      if (page.page_kind === 'contact') {
        return renderContactPageContent(page);
      }

      const [business, services, areas, archivePaths] = await Promise.all([
        getBusiness(),
        getActiveServices(),
        getActiveAreas(),
        getActiveArchivePagePaths(),
      ]);

      const templateContent = toTemplatePageContent(page.content);
      const blocks = templateContent ? [] : toBlocks(page.content);
      const showPageHero = !templateContent || templateContent.templateKey === 'content-page-v1';
      const pageSchema = buildWebPageSchema({
        business,
        title: page.title,
        description: page.meta_description,
        pathname: `/${page.slug}`,
      });

      return (
        <div className="page page--cms">
          <StructuredData data={pageSchema} />
          {showPageHero ? (
            <PageHero
              heading={page.title}
              lede={page.meta_description ?? undefined}
              className="page__hero"
            />
          ) : null}
          {templateContent ? (
            <TemplatePageRenderer
              content={templateContent}
              context={{
                page: { title: page.title, metaDescription: page.meta_description },
                business,
                services,
                serviceAreas: areas,
                archivePaths,
                url: `/${page.slug}`,
              }}
            />
          ) : (
            <BlockRenderer blocks={blocks} />
          )}
        </div>
      );
    }

    notFound();
  }

  if (slug.length === 2) {
    const business = await getBusiness();
    const baseSegment = slug[0]?.trim().toLowerCase() ?? '';
    if (baseSegment === getServiceDetailBaseSegment(business?.settings)) {
      return renderServiceDetailPageBySlug(slug[1] ?? '');
    }
    if (baseSegment === getAreaDetailBaseSegment(business?.settings)) {
      return renderAreaDetailPageBySlug(slug[1] ?? '');
    }
  }

  notFound();
}
