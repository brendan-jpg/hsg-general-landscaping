import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { BlogGridSection, PageHero } from '@/lib/sections-core/frontend';
import TemplatePageRenderer from '@/components/integrations/TemplatePageRenderer';
import { toTemplatePageContent } from '@/lib/sections/templatePages';
import { getActiveArchivePagePaths, getActivePageByKind, getPublishedBlogPosts } from '@/lib/content/queries';
import { buildDynamicMetadata } from '@/lib/utils/seo';

interface BlogPageProps {
  searchParams?: Promise<{ page?: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await getActivePageByKind('blog_archive');

  return buildDynamicMetadata({
    titleTemplate: page?.meta_title,
    descriptionTemplate: page?.meta_description,
    fallbackTitle: page?.title || 'Blog',
    fallbackDescription: page?.meta_description,
    imageUrl: page?.og_image_url,
    pathname: page?.slug ? `/${page.slug}` : '/blog',
  });
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const params = (await searchParams) ?? {};
  const [posts, page, archivePaths] = await Promise.all([
    getPublishedBlogPosts(),
    getActivePageByKind('blog_archive'),
    getActiveArchivePagePaths(),
  ]);
  if (page?.slug && page.slug !== 'blog') {
    const nextUrl = new URL(`/${page.slug}`, 'https://example.com');
    if (params.page) nextUrl.searchParams.set('page', params.page);
    redirect(`${nextUrl.pathname}${nextUrl.search}`);
  }
  const pageSize = 9;
  const currentPage = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const totalPages = Math.max(1, Math.ceil(posts.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const start = (safePage - 1) * pageSize;
  const visiblePosts = posts.slice(start, start + pageSize);
  const templateContent = toTemplatePageContent(page?.content);
  const hasArchiveBlocks =
    templateContent?.sections.some((section) =>
      ['blog_grid_section', 'blog_archive_grid_section'].includes(section.type),
    ) ?? false;

  return (
    <div className="page page--blog">
      {templateContent && hasArchiveBlocks ? (
        <TemplatePageRenderer
          content={templateContent}
          context={{
            archivePaths,
            url: page?.slug ? `/${page.slug}` : '/blog',
            page: { title: page?.title ?? 'Blog', metaDescription: page?.meta_description },
            blogArchivePosts: visiblePosts,
            blogArchivePagination: {
              currentPage: safePage,
              totalPages,
              basePath: page?.slug ? `/${page.slug}` : '/blog',
            },
          }}
        />
      ) : (
        <>
          <PageHero
            heading="Blog"
            lede="Tips, project examples, and answers to common questions from our team."
            meta={`${posts.length} article${posts.length === 1 ? '' : 's'}`}
            className="blog-archive__hero blog-archive-hero-section"
          />
          {posts.length === 0 ? (
            <p className="services-list__empty">Articles coming soon.</p>
          ) : (
            <BlogGridSection
              posts={visiblePosts}
              currentPage={safePage}
              totalPages={totalPages}
              basePath={page?.slug ? `/${page.slug}` : '/blog'}
            />
          )}
        </>
      )}
    </div>
  );
}




