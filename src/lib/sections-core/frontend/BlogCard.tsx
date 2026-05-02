import Link from 'next/link';
import AppImage from '../components/shared/AppImage';

interface BlogCardProps {
  post: {
    id: string;
    title: string;
    slug: string;
    excerpt?: string | null;
    featured_image_url?: string | null;
    published_at?: string | null;
    read_time_minutes?: number | null;
  };
}

export default function BlogCard({ post }: BlogCardProps) {
  const cardImageSizes = '(max-width: 767px) 100vw, (max-width: 1100px) 50vw, 380px';
  return (
    <Link href={`/blog/${post.slug}`} className="blog-card">
      {post.featured_image_url && (
        <div className="blog-card__image">
          <AppImage role="card" src={post.featured_image_url} alt={post.title} width={1200} height={675} sizes={cardImageSizes} />
        </div>
      )}
      <div className="blog-card__body">
        <span className="blog-card__meta">
          {/* {formatDate(post.published_at)} */}
          {post.read_time_minutes && ` - ${post.read_time_minutes} min read`}
        </span>
        <h3 className="blog-card__title">{post.title}</h3>
        {post.excerpt && <p className="blog-card__excerpt">{post.excerpt}</p>}
      </div>
    </Link>
  );
}


