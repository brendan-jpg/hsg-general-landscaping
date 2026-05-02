import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { PageHero } from '@/lib/sections-core/frontend';
import BlockRenderer from "../../../components/shared/BlockRenderer";
import TemplatePageRenderer from '@/components/integrations/TemplatePageRenderer';
import { toTemplatePageContent } from '@/lib/sections/templatePages';
import { getActiveArchivePagePaths, getActivePageByKind, getPublishedBlogPosts, getTeamMembers } from '@/lib/content/queries';
import { toBlocks } from '@/lib/frontend/content';
import { getBusiness } from '@/lib/utils/business';
import { buildDynamicMetadata } from '@/lib/utils/seo';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getActivePageByKind('about');

  return buildDynamicMetadata({
    titleTemplate: page?.meta_title,
    descriptionTemplate: page?.meta_description,
    fallbackTitle: page?.title || 'About',
    fallbackDescription: page?.meta_description,
    imageUrl: page?.og_image_url,
    pathname: page?.slug ? `/${page.slug}` : '/about',
  });
}

export default async function AboutPage() {
  const [page, business, teamMembers, blogPosts, archivePaths] = await Promise.all([
    getActivePageByKind('about'),
    getBusiness(),
    getTeamMembers(),
    getPublishedBlogPosts(),
    getActiveArchivePagePaths(),
  ]);
  if (page?.slug && page.slug !== 'about') {
    redirect(`/${page.slug}`);
  }
  const templateContent = toTemplatePageContent(page?.content);
  const blocks = templateContent ? [] : toBlocks(page?.content);

  return (
    <div className="page page--about">
      {!templateContent && (
        <PageHero
          heading={page?.title ?? 'About Us'}
          lede={page?.meta_description ?? 'Learn about our team, our process, and the standards behind every project.'}
          className="about__hero"
        />
      )}
      {templateContent ? (
        <TemplatePageRenderer
          content={templateContent}
          context={{
            page: { title: page?.title, metaDescription: page?.meta_description },
            business,
            teamMembers,
            relatedBlogPosts: blogPosts.slice(0, 3),
            archivePaths,
            url: page?.slug ? `/${page.slug}` : '/about',
          }}
        />
      ) : (
        <BlockRenderer blocks={blocks} />
      )}
    </div>
  );
}





