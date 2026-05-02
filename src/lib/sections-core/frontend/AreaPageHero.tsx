import IconValue from '../components/shared/IconValue';
import HeroImage from './HeroImage';

type AreaHeroVariant = 'default' | 'split' | 'feature';

interface ServiceAreaHeroProps {
  variant?: AreaHeroVariant | string;
  heading?: string;
  lede?: string | null;
  featuredImageUrl?: string | null;
  iconValue?: string | null;
  className?: string;
  imageClassName?: string;
}

function normalizeVariant(variant?: string): AreaHeroVariant {
  return variant === 'split' || variant === 'feature' ? variant : 'default';
}

export default function AreaPageHero({
  variant,
  heading,
  lede,
  featuredImageUrl,
  iconValue,
  className = 'area__hero',
  imageClassName = 'area__featured-image',
}: ServiceAreaHeroProps) {
  const trimmedHeading = (heading ?? '').trim();
  const heroVariant = normalizeVariant(variant);
  const hasImage = Boolean(featuredImageUrl);
  const image = hasImage ? <HeroImage url={featuredImageUrl} alt={trimmedHeading || ''} className={imageClassName} /> : null;
  const titleRow = (
    <div className="area__title-row">
      {iconValue ? (
        <span className="area__icon" aria-hidden="true">
          <IconValue value={iconValue} imageClassName="area__icon-image" />
        </span>
      ) : null}
      {trimmedHeading ? <h1 className="area__title">{trimmedHeading}</h1> : null}
    </div>
  );
  const introCopy = (
    <>
      {titleRow}
      {lede ? <p className="area__excerpt">{lede}</p> : null}
    </>
  );

  if (heroVariant === 'split') {
    return (
      <section className={className}>
        <div className="area__hero-inner container">
          <div className={`area__hero-layout area__hero-layout--split${hasImage ? ' area__hero-layout--with-image' : ''}`}>
            <div className="area__hero-copy">
              {introCopy}
            </div>
            {image ? <div className="area__hero-media">{image}</div> : null}
          </div>
        </div>
      </section>
    );
  }

  if (heroVariant === 'feature') {
    return (
      <section className={className}>
        <div className="area__hero-inner container">
          <div className={`area__hero-feature${hasImage ? ' area__hero-feature--with-image' : ''}`}>
            {image ? <div className="area__hero-feature-media">{image}</div> : null}
            <div className="area__hero-feature-panel">
              {introCopy}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={className}>
      <div className="area__hero-inner container">
        <div className={`area__hero-shell${hasImage ? ' area__hero-shell--with-image' : ''}`}>
          {image}
          <div className="area__hero-overlay" aria-hidden="true" />
          <div className="area__hero-panel">
            {introCopy}
          </div>
        </div>
      </div>
    </section>
  );
}
