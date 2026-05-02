import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ContentPageHeader from '@/components/frontend/ContentPageHeader';
import BlockRenderer from '@/components/shared/BlockRenderer';
import TemplatePageRenderer from '@/components/shared/TemplatePageRenderer';
import { toTemplatePageContent } from '@/lib/content/templatePages';
import { getActivePageBySlug } from '@/lib/content/queries';
import { toBlocks } from '@/lib/frontend/content';
import { buildDynamicMetadata } from '@/lib/utils/seo';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getActivePageBySlug(slug);
  if (!page) return {};

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

export default async function DynamicCmsPage({ params }: Props) {
  const { slug } = await params;
  const page = await getActivePageBySlug(slug);
  if (!page) notFound();

  const templateContent = toTemplatePageContent(page.content);
  const blocks = templateContent ? [] : toBlocks(page.content);

  return (
    <article className="page page--cms">
      {!templateContent && <ContentPageHeader title={page.title} accent="Page" className="page__header" />}
      <div className="page__content">
        {templateContent ? <TemplatePageRenderer content={templateContent} /> : <BlockRenderer blocks={blocks} />}
      </div>
    </article>
  );
}
