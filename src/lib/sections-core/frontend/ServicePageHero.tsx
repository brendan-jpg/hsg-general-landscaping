import type { ReactNode } from 'react';
import HeroImage from './HeroImage';

type ServiceHeroVariant = 'default' | 'split' | 'feature';

interface ServicePageHeroProps {
  accent?: string;
  variant?: ServiceHeroVariant | string;
  heading?: string;
  lede?: string | null;
  featuredImageUrl?: string | null;
  breadcrumb?: ReactNode;
  icon?: ReactNode;
  className?: string;
  imageClassName?: string;
}

function normalizeVariant(variant?: string): ServiceHeroVariant {
  return variant === 'split' || variant === 'feature' ? variant : 'default';
}

export default function ServicePageHero({
  accent,
  variant,
  heading,
  lede,
  featuredImageUrl,
  breadcrumb,
  icon,
  className = 'service__hero',
  imageClassName = 'service__featured-image',
}: ServicePageHeroProps) {
  const trimmedHeading = (heading ?? '').trim();
  const trimmedAccent = (accent ?? '').trim();
  const heroVariant = normalizeVariant(variant);
  const hasImage = Boolean(featuredImageUrl);
  const image = hasImage ? <HeroImage url={featuredImageUrl} alt={trimmedHeading || ''} className={imageClassName} /> : null;
  const titleRow = (
    <div className="service__title-row">
      {icon ? <span className="service__icon" aria-hidden="true">{icon}</span> : null}
      {trimmedHeading ? <h1 className="service__title">{trimmedHeading}</h1> : null}
    </div>
  );
  const introCopy = (
    <>
      {titleRow}
      {trimmedAccent ? <p className="service__accent">{trimmedAccent}</p> : null}
      {lede ? <p className="service__excerpt">{lede}</p> : null}
    </>
  );

  if (heroVariant === 'split') {
    return (
      <section className={className}>
        <div className="service__hero-inner container">
          <div className={`service__hero-layout service__hero-layout--split${hasImage ? ' service__hero-layout--with-image' : ''}`}>
            <div className="service__hero-copy">
              {breadcrumb}
              {introCopy}
            </div>
            {image ? <div className="service__hero-media">{image}</div> : null}
          </div>
        </div>
      </section>
    );
  }

  if (heroVariant === 'feature') {
    return (
      <section className={className}>
        <div className="service__hero-inner container">
          <div className={`service__hero-feature${hasImage ? ' service__hero-feature--with-image' : ''}`}>
            {image ? <div className="service__hero-feature-media">{image}</div> : null}
            <div className="service__hero-feature-panel">
              {breadcrumb}
              {introCopy}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={className}>
      <div className="service__hero-inner container">
        <div className={`service__hero-shell${hasImage ? ' service__hero-shell--with-image' : ''}`}>
          {image}
          <div className="service__hero-overlay" aria-hidden="true" />
          <div className="service__hero-panel">
            {breadcrumb}
            {introCopy}
          </div>
        </div>
      </div>
    </section>
  );
}
