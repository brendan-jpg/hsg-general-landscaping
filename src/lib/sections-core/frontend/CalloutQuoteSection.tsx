import AppImage from '../components/shared/AppImage';
import PageSection from './PageSection';

interface HeroSlide {
  id: string;
  file_url: string;
}

interface CalloutQuoteSectionProps {
  quote?: string | null;
  attribution?: string | null;
  heading?: string;
  className?: string;
  hideTitle?: boolean;
  heroSlides?: HeroSlide[];
  headingAs?: 'h1' | 'h2';
}

export default function CalloutQuoteSection({
  quote,
  attribution,
  heading = 'What Clients Say',
  className,
  hideTitle = false,
  heroSlides = [],
  headingAs = 'h2',
}: CalloutQuoteSectionProps) {
  if (!quote?.trim()) return null;

  if (hideTitle) {
    const slideSeconds = 4;
    const hasSlides = heroSlides.length > 1;
    const cycleSeconds = Math.max(slideSeconds * heroSlides.length, 6);
    return (
      <section className={['content-section', 'hero', 'callout-quote-hero', className].filter(Boolean).join(' ')}>
        <div className="hero__bg-slides" aria-hidden="true">
          {heroSlides.length > 0 ? (
            heroSlides.map((image, index) => (
              <AppImage
                key={`${image.id}-${index}`}
                role={index === 0 ? 'hero' : 'gallery'}
                src={image.file_url}
                alt=""
                fill
                priority={index === 0}
                fetchPriority={index === 0 ? 'high' : 'auto'}
                loading={index === 0 ? 'eager' : 'lazy'}
                className={`hero__bg hero__bg-slide${hasSlides ? ' hero__bg-slide--animated' : ''}`}
                style={
                  hasSlides
                    ? {
                        animationDelay: `${index * slideSeconds}s`,
                        animationDuration: `${cycleSeconds}s`,
                      }
                    : undefined
                }
              />
            ))
          ) : (
            <div className="hero__bg hero__bg-fallback" />
          )}
        </div>
        <div className="hero__overlay" aria-hidden="true" />
        <div className="hero__inner callout-quote-hero__inner container">
          <figure className="callout-quote callout-quote--hero">
            <span className="callout-quote__icon" aria-hidden="true">&ldquo;</span>
            <blockquote className="callout-quote__text">&ldquo;{quote.trim()}&rdquo;</blockquote>
            {attribution ? <figcaption className="callout-quote__attribution">{attribution}</figcaption> : null}
          </figure>
        </div>
      </section>
    );
  }

  return (
    <PageSection heading={heading} className={className} headingAs={headingAs}>
      <figure className="callout-quote">
        <blockquote className="callout-quote__text">&ldquo;{quote.trim()}&rdquo;</blockquote>
        {attribution ? <figcaption className="callout-quote__attribution">{attribution}</figcaption> : null}
      </figure>
    </PageSection>
  );
}

