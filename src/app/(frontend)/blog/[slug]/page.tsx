import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import TemplatePageRenderer from '@/components/integrations/TemplatePageRenderer';
import StructuredData from '@/components/shared/StructuredData';
import { getPublishedBlogPostBySlug, getRelatedPublishedBlogPosts } from '@/lib/content/queries';
import { convertBasicBlocksToTemplatePageContent, toTemplatePageContent } from '@/lib/sections/templatePages';
import { getActiveServices } from '@/lib/services/queries';
import { getBusiness } from '@/lib/utils/business';
import { buildBlogPostingSchema } from '@/lib/utils/schema';
import { buildDynamicMetadata } from '@/lib/utils/seo';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedBlogPostBySlug(slug);
  if (!post) return {};

  return buildDynamicMetadata({
    titleTemplate: post.meta_title,
    descriptionTemplate: post.meta_description,
    fallbackTitle: post.title,
    fallbackDescription: post.excerpt,
    imageUrl: post.featured_image_url,
    pathname: `/blog/${post.slug}`,
    tokens: {
      post: post.title,
      blog_post: post.title,
    },
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPublishedBlogPostBySlug(slug);

  if (!post) notFound();
  const [relatedPosts, business, services] = await Promise.all([
    getRelatedPublishedBlogPosts(post.id, 3),
    getBusiness(),
    getActiveServices(),
  ]);

  const templateContent =
    toTemplatePageContent(post.content) ??
    convertBasicBlocksToTemplatePageContent(post.content, 'blog-post-content-v1', post.title || 'Article');
  const publishedLabel = post.published_at
    ? new Date(post.published_at).toLocaleDateString()
    : new Date(post.created_at).toLocaleDateString();
  const blogSchema = buildBlogPostingSchema({
    business,
    title: post.title,
    description: post.meta_description || post.excerpt,
    imageUrl: post.featured_image_url,
    pathname: `/blog/${post.slug}`,
    publishedAt: post.published_at,
    updatedAt: post.updated_at,
  });

  return (
    <div className="page page--blog-post blog-post">
      <StructuredData data={blogSchema} />
      {templateContent ? (
        <TemplatePageRenderer
          content={templateContent}
          context={{
            blogPost: post,
            business,
            services,
            blogPublishedLabel: publishedLabel,
            relatedBlogPosts: relatedPosts,
            url: `/blog/${post.slug}`,
          }}
        />
      ) : null}
    </div>
  );
}



