import AppImage from '../components/shared/AppImage';
import { getSectionsRuntime } from '../lib/runtime';
import PrimaryButton from '../components/ui/PrimaryButton';
import SecondaryButton from '../components/ui/SecondaryButton';

type HomeHeroVariant = 'default' | 'split' | 'feature';

interface HeroProps {
  heading?: string;
  lede?: string;
  accent?: string;
  variant?: HomeHeroVariant | string;
  primaryCtaText?: string;
  primaryCtaHref?: string;
  secondaryCtaText?: string;
  secondaryCtaHref?: string;
  className?: string;
}

function normalizeVariant(variant?: string): HomeHeroVariant {
  return variant === 'split' || variant === 'feature' ? variant : 'default';
}

export default async function Hero({
  heading,
  lede,
  accent,
  variant,
  primaryCtaText = 'Get a Quote',
  primaryCtaHref = '/contact',
  secondaryCtaText = 'Our Services',
  secondaryCtaHref = '/services',
  className,
}: HeroProps = {}) {
  const primaryServiceGalleryImages = await getSectionsRuntime().queries.getPrimaryServiceGalleryImages(1);
  const resolvedLede = lede?.trim() || '';
  const resolvedAccent = accent?.trim() || '';
  const resolvedHeading = (heading?.trim() || '').trim();
  const heroVariant = normalizeVariant(variant);
  const heroImage = primaryServiceGalleryImages.find((image) => Boolean(image.file_url)) ?? null;
  const actions = (
    <div className="hero__actions">
      <PrimaryButton href={primaryCtaHref || '/contact'} size="btn--lg">{primaryCtaText || 'Get a Quote'}</PrimaryButton>
      <SecondaryButton href={secondaryCtaHref || '/services'} size="btn--lg">{secondaryCtaText || 'Our Services'}</SecondaryButton>
    </div>
  );
  const introCopy = (
    <>
      {resolvedHeading ? <h1 className="hero__title">{resolvedHeading}</h1> : null}
      {resolvedAccent ? <p className="hero__accent">{resolvedAccent}</p> : null}
      {resolvedLede ? <p className="hero__subtitle">{resolvedLede}</p> : null}
      {actions}
    </>
  );
  const image = heroImage?.file_url
    ? <AppImage role="hero" src={heroImage.file_url} alt="" fill priority fetchPriority="high" loading="eager" className="hero__bg" />
    : <div className="hero__bg hero__bg-fallback" aria-hidden="true" />;

  if (heroVariant === 'split') {
    return (
      <section className={['hero', className].filter(Boolean).join(' ')}>
        <div className="hero__bg hero__bg-layer hero__bg-layer--4" aria-hidden="true" />
        <div className="hero__bg hero__bg-layer hero__bg-layer--5" aria-hidden="true" />
        <div className="hero__inner container">
          <div className="hero__layout hero__layout--split">
            <div className="hero__copy">
              {introCopy}
            </div>
            <div className="hero__media">
              {image}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (heroVariant === 'feature') {
    return (
      <section className={['hero', className].filter(Boolean).join(' ')}>
        <div className="hero__inner container">
          <div className="hero__feature">
            <div className="hero__feature-copy">
              {introCopy}
            </div>
            <div className="hero__feature-media">
              {image}
              <div className="hero__feature-overlay" aria-hidden="true" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={['hero', className].filter(Boolean).join(' ')}>
      {image}
      <div className="hero__overlay" aria-hidden="true" />
      <div className="hero__inner container">
        <div className="hero__grid">
          {introCopy}
        </div>
      </div>
    </section>
  );
}
