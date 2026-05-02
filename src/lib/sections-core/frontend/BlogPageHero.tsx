import HeroImage from './HeroImage';

type BlogHeroVariant = 'default' | 'split' | 'feature';

interface BlogPageHeroProps {
  heading?: string;
  accent?: string;
  lede?: string | null;
  dateLabel: string;
  readTimeMinutes?: number | null;
  featuredImageUrl?: string | null;
  variant?: BlogHeroVariant | string;
  sectionClassName?: string;
  headerClassName?: string;
  imageClassName?: string;
}

function normalizeVariant(variant?: string): BlogHeroVariant {
  return variant === 'split' || variant === 'feature' ? variant : 'default';
}

export default function BlogPageHero({
  heading,
  accent,
  lede,
  dateLabel,
  readTimeMinutes,
  featuredImageUrl,
  variant,
  sectionClassName = 'blog-post__hero',
  headerClassName = 'blog-post__hero-content',
  imageClassName = 'blog-post__featured-image',
}: BlogPageHeroProps) {
  const trimmedHeading = (heading ?? '').trim();
  const heroVariant = normalizeVariant(variant);
  const hasImage = Boolean(featuredImageUrl);
  const image = hasImage ? <HeroImage url={featuredImageUrl} alt={trimmedHeading || ''} className={imageClassName} /> : null;
  const copy = (
    <>
      {trimmedHeading ? <h1 className="blog-post__title">{trimmedHeading}</h1> : null}
      {accent ? <p className="page-hero__accent blog-post__accent">{accent}</p> : null}
      <span className="blog-post__date">{dateLabel}</span>
      {lede ? <p className="blog-post__excerpt">{lede}</p> : null}
      {readTimeMinutes ? <span className="blog-post__read-time">{readTimeMinutes} min read</span> : null}
    </>
  );

  if (heroVariant === 'split') {
    return (
      <section className={sectionClassName}>
        <div className="blog-post__hero-inner container">
          <div className={`blog-post__layout blog-post__layout--split${hasImage ? ' blog-post__layout--with-image' : ''}`}>
            <div className={headerClassName}>
              {copy}
            </div>
            {image ? <div className="blog-post__media">{image}</div> : null}
          </div>
        </div>
      </section>
    );
  }

  if (heroVariant === 'feature') {
    return (
      <section className={sectionClassName}>
        <div className="blog-post__hero-inner container">
          <div className={`blog-post__feature${hasImage ? ' blog-post__feature--with-image' : ''}`}>
            {image ? <div className="blog-post__feature-media">{image}</div> : null}
            <div className={`${headerClassName} blog-post__feature-panel`}>
              {copy}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={sectionClassName}>
      <div className="blog-post__hero-inner container">
        <div className={headerClassName}>
          {copy}
        </div>
        {image}
      </div>
    </section>
  );
}
