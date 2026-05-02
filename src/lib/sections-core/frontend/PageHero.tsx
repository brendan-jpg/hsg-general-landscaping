import type { ReactNode } from 'react';

type PageHeroVariant = 'default' | 'split' | 'feature';

interface PageHeroProps {
  heading: string;
  accent?: string;
  lede?: string;
  meta?: ReactNode;
  variant?: PageHeroVariant | string;
  className?: string;
}

function normalizeVariant(variant?: string): PageHeroVariant {
  return variant === 'split' || variant === 'feature' ? variant : 'default';
}

export default function PageHero({
  heading,
  accent,
  lede,
  meta,
  variant,
  className,
}: PageHeroProps) {
  const trimmedHeading = heading.trim();
  const heroVariant = normalizeVariant(variant);
  const copy = (
    <>
      {trimmedHeading ? <h1 className="page__title page-hero__title">{trimmedHeading}</h1> : null}
      {accent ? <p className="page-hero__accent">{accent}</p> : null}
      {lede ? <p className="page-hero__description">{lede}</p> : null}
      {meta ? <div className="page-hero__meta">{meta}</div> : null}
    </>
  );

  if (heroVariant === 'split') {
    return (
      <section className={['page-hero', className].filter(Boolean).join(' ')}>
        <div className="page-hero__inner container">
          <div className="page-hero__layout page-hero__layout--split">
            <div className="page-hero__copy">
              {copy}
            </div>
            <div className="page-hero__feature" aria-hidden="true" />
          </div>
        </div>
      </section>
    );
  }

  if (heroVariant === 'feature') {
    return (
      <section className={['page-hero', className].filter(Boolean).join(' ')}>
        <div className="page-hero__inner container">
          <div className="page-hero__layout page-hero__layout--feature">
            <div className="page-hero__feature" aria-hidden="true" />
            <div className="page-hero__copy page-hero__copy--feature">
              {copy}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={['page-hero', className].filter(Boolean).join(' ')}>
      <div className="page-hero__inner container">
        <div className="page-hero__copy">
          {copy}
        </div>
      </div>
    </section>
  );
}
