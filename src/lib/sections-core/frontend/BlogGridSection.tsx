import Link from 'next/link';
import type { Tables } from '../lib/types/database';
import BlogCard from './BlogCard';
import PageSection from './PageSection';

type BlogPost = Tables<'blog_posts'>;

interface BlogGridSectionProps {
  posts: BlogPost[];
  heading?: string;
  accent?: string;
  lede?: string;
  className?: string;
  gridClassName?: string;
  variant?: 'default' | 'condensed';
  viewAllHref?: string;
  currentPage?: number;
  totalPages?: number;
  basePath?: string;
  headingAs?: 'h1' | 'h2';
}

export default function BlogGridSection({
  posts,
  heading = 'Articles',
  accent,
  lede,
  className,
  gridClassName,
  variant = 'default',
  viewAllHref,
  currentPage,
  totalPages,
  basePath,
  headingAs = 'h2',
}: BlogGridSectionProps) {
  if (posts.length === 0) return null;

  const showPagination = typeof currentPage === 'number' && typeof totalPages === 'number' && totalPages > 1;
  const hrefForPage = (page: number) => ((basePath ?? '/blog') && page <= 1 ? (basePath ?? '/blog') : `${basePath ?? '/blog'}?page=${page}`);
  const pages = showPagination ? Array.from({ length: totalPages }, (_, index) => index + 1) : [];
  const action = variant === 'condensed' && viewAllHref ? <Link href={viewAllHref} className="btn btn--secondary">View All</Link> : null;

  return (
    <PageSection
      heading={heading}
      accent={accent}
      lede={lede}
      headingAs={headingAs}
      className={className}
    >
      <div className={['blog__grid', 'auto-grid', gridClassName].filter(Boolean).join(' ')}>
        {posts.map((post) => (
          <BlogCard key={post.id} post={post} />
        ))}
      </div>
      {action ? <div className="content-section__action content-section__action--below">{action}</div> : null}
      {showPagination ? (
        <nav className="pager blog__pagination" aria-label="Blog pagination">
          <Link
            href={hrefForPage(Math.max(1, currentPage - 1))}
            aria-disabled={currentPage <= 1}
            className={`pager__link${currentPage <= 1 ? ' pager__link--disabled' : ''}`}
          >
            Previous
          </Link>
          <div className="pager__pages">
            {pages.map((page) => (
              <Link
                key={page}
                href={hrefForPage(page)}
                aria-current={page === currentPage ? 'page' : undefined}
                className={`pager__page${page === currentPage ? ' pager__page--active' : ''}`}
              >
                {page}
              </Link>
            ))}
          </div>
          <Link
            href={hrefForPage(Math.min(totalPages, currentPage + 1))}
            aria-disabled={currentPage >= totalPages}
            className={`pager__link${currentPage >= totalPages ? ' pager__link--disabled' : ''}`}
          >
            Next
          </Link>
        </nav>
      ) : null}
    </PageSection>
  );
}
