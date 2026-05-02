'use client';

import { useEffect, useMemo, useState } from 'react';
import AppImage from '../components/shared/AppImage';
import PageSection from './PageSection';

interface GalleryItem {
  id: string;
  file_url: string;
  caption?: string | null;
}

interface GallerySectionProps {
  images: GalleryItem[];
  heading?: string;
  accent?: string;
  lede?: string;
  className?: string;
  autoPlayMs?: number;
  headingAs?: 'h1' | 'h2';
}

export default function GallerySection({
  images,
  heading = '',
  accent,
  lede,
  className,
  autoPlayMs = 3500,
  headingAs = 'h2',
}: GallerySectionProps) {
  const galleryImageSizes = '(max-width: 575px) calc(100vw - 2rem), (max-width: 991px) min(92vw, 760px), min(82vw, 980px)';
  const safeImages = useMemo(() => images.filter((image) => image.file_url), [images]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (safeImages.length <= 1) return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % safeImages.length);
    }, autoPlayMs);

    return () => window.clearInterval(timer);
  }, [autoPlayMs, safeImages.length]);

  if (safeImages.length === 0) return null;

  const normalizedActiveIndex = ((activeIndex % safeImages.length) + safeImages.length) % safeImages.length;

  const goTo = (index: number) => {
    setActiveIndex(index);
  };

  const goPrev = () => {
    setActiveIndex((current) => (current - 1 + safeImages.length) % safeImages.length);
  };

  const goNext = () => {
    setActiveIndex((current) => (current + 1) % safeImages.length);
  };

  return (
    <PageSection heading={heading} accent={accent} lede={lede} className={className} headingAs={headingAs}>
      <div className="media-slider" aria-roledescription="carousel" aria-label="Gallery slider">
        <div
          className="media-slider__track"
          style={{ transform: `translateX(-${normalizedActiveIndex * 100}%)` }}
        >
          {safeImages.map((image, imageIndex) => (
            <article key={image.id || `gallery-image-${imageIndex}`} className="gallery-grid__item media-grid__item media-slider__slide">
              <AppImage
                role="gallery"
                src={image.file_url}
                alt={image.caption || `Gallery image ${imageIndex + 1}`}
                width={900}
                height={675}
                priority={imageIndex === normalizedActiveIndex}
                sizes={galleryImageSizes}
              />
            </article>
          ))}
        </div>

        {safeImages.length > 1 ? (
          <div className="media-slider__controls">
            <button type="button" className="btn btn--md" onClick={goPrev} aria-label="Previous gallery image">
              Prev
            </button>
            <div className="media-slider__dots" aria-label={`Gallery image ${normalizedActiveIndex + 1} of ${safeImages.length}`}>
              {safeImages.map((_, index) => (
                <button
                  key={`gallery-dot-${index}`}
                  type="button"
                  className={`media-slider__dot${index === normalizedActiveIndex ? ' media-slider__dot--active' : ''}`}
                  onClick={() => goTo(index)}
                  aria-label={`Go to gallery image ${index + 1}`}
                  aria-current={index === normalizedActiveIndex ? 'true' : undefined}
                />
              ))}
            </div>
            <button type="button" className="btn btn--md" onClick={goNext} aria-label="Next gallery image">
              Next
            </button>
          </div>
        ) : null}
      </div>
    </PageSection>
  );
}

