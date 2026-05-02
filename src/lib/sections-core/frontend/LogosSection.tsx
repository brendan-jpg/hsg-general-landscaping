import Link from 'next/link';
import AppImage from '../components/shared/AppImage';
import PageSection from './PageSection';

export interface LogosSectionItem {
  image: string;
  alt?: string;
  label?: string;
  href?: string;
}

interface LogosSectionProps {
  logos: LogosSectionItem[];
  heading?: string;
  accent?: string;
  lede?: string;
  className?: string;
  headingAs?: 'h1' | 'h2';
}

export default function LogosSection({
  logos,
  heading = 'Trusted Brands & Certifications',
  accent,
  lede,
  className,
  headingAs = 'h2',
}: LogosSectionProps) {
  const visibleLogos = logos.filter((logo) => (logo.image ?? '').trim().length > 0);

  if (visibleLogos.length === 0) return null;

  return (
    <PageSection
      heading={heading}
      accent={accent}
      lede={lede}
      headingAs={headingAs}
      className={['logos-section', className].filter(Boolean).join(' ')}
    >
      <div className="logos-section__grid auto-grid">
        {visibleLogos.map((logo, index) => {
          const imageAlt = (logo.alt ?? '').trim() || (logo.label ?? '').trim() || `Logo ${index + 1}`;
          const label = (logo.label ?? '').trim();
          const href = (logo.href ?? '').trim();
          const image = (
            <div className="logos-section__media">
              <AppImage role="card" src={logo.image} alt={imageAlt} width={480} height={240} />
            </div>
          );

          return (
            <article key={`${logo.image}-${index}`} className="logos-section__item">
              {href ? (
                <Link href={href} className="logos-section__link">
                  {image}
                  {label ? <span className="logos-section__label">{label}</span> : null}
                </Link>
              ) : (
                <>
                  {image}
                  {label ? <span className="logos-section__label">{label}</span> : null}
                </>
              )}
            </article>
          );
        })}
      </div>
    </PageSection>
  );
}
