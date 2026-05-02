'use client';

import { useEffect, useMemo, useState } from 'react';
import AppImage from '../components/shared/AppImage';
import type { BeforeAfterGroup } from '../lib/frontend/content';
import PageSection from './PageSection';

interface BeforeAfterSectionProps {
  groups: BeforeAfterGroup[];
  itemLabel: string;
  heading?: string;
  accent?: string;
  lede?: string;
  className?: string;
  autoPlayMs?: number;
  headingAs?: 'h1' | 'h2';
}

function BeforeAfterColumnGallery({
  urls,
  label,
  itemLabel,
  groupIndex,
  activeGroup,
}: {
  urls: string[];
  label: 'Before' | 'After';
  itemLabel: string;
  groupIndex: number;
  activeGroup: boolean;
}) {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  useEffect(() => {
    setActivePhotoIndex(0);
  }, [groupIndex, urls]);

  useEffect(() => {
    if (!activeGroup || urls.length <= 1) return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) return;

    const timer = window.setInterval(() => {
      setActivePhotoIndex((current) => (current + 1) % urls.length);
    }, 3200);

    return () => window.clearInterval(timer);
  }, [activeGroup, urls]);

  if (urls.length === 0) {
    return <p className="before-after__empty">No {label.toLowerCase()} photo.</p>;
  }

  const normalizedPhotoIndex = ((activePhotoIndex % urls.length) + urls.length) % urls.length;
  const activeUrl = urls[normalizedPhotoIndex];

  return (
    <div className="before-after__gallery">
      <div className="before-after__viewer">
        <div className="before-after__photo before-after__photo--viewer">
          <AppImage
            role="gallery"
            src={activeUrl}
            alt={`${itemLabel} ${label.toLowerCase()} photo group ${groupIndex + 1} image ${normalizedPhotoIndex + 1}`}
            width={1200}
            height={900}
            priority={activeGroup && normalizedPhotoIndex === 0}
          />
        </div>
      </div>
      {urls.length > 1 ? (
        <div className="before-after__thumbs" aria-label={`${label} gallery thumbnails`}>
          {urls.map((url, photoIndex) => {
            const isActive = photoIndex === normalizedPhotoIndex;
            return (
              <button
                key={`${label.toLowerCase()}-thumb-${groupIndex}-${url}-${photoIndex}`}
                type="button"
                className={`before-after__thumb${isActive ? ' before-after__thumb--active' : ''}`}
                onClick={() => setActivePhotoIndex(photoIndex)}
                aria-label={`Show ${label.toLowerCase()} image ${photoIndex + 1}`}
                aria-pressed={isActive}
              >
                <AppImage
                  role="gallery"
                  src={url}
                  alt=""
                  width={240}
                  height={180}
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function BeforeAfterSection({
  groups,
  itemLabel,
  heading = 'Before & After',
  accent,
  lede,
  className,
  autoPlayMs = 3500,
  headingAs = 'h2',
}: BeforeAfterSectionProps) {
  const safeGroups = useMemo(
    () => groups.filter((group) => group.before_urls.length > 0 || group.after_urls.length > 0),
    [groups],
  );
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (safeGroups.length <= 1) return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % safeGroups.length);
    }, autoPlayMs);

    return () => window.clearInterval(timer);
  }, [autoPlayMs, safeGroups.length]);

  if (safeGroups.length === 0) return null;

  const normalizedActiveIndex = ((activeIndex % safeGroups.length) + safeGroups.length) % safeGroups.length;

  const goTo = (index: number) => {
    setActiveIndex(index);
  };

  const goPrev = () => {
    setActiveIndex((current) => (current - 1 + safeGroups.length) % safeGroups.length);
  };

  const goNext = () => {
    setActiveIndex((current) => (current + 1) % safeGroups.length);
  };

  return (
    <PageSection heading={heading} accent={accent} lede={lede} className={className} headingAs={headingAs}>
      <div className="media-slider" aria-roledescription="carousel" aria-label="Before and after slider">
        <div
          className="media-slider__track"
          style={{ transform: `translateX(-${normalizedActiveIndex * 100}%)` }}
        >
          {safeGroups.map((group, index) => (
            <article key={`before-after-group-${index}`} className="before-after__group media-slider__slide">
              <h3>Group {index + 1}</h3>
              <div className="before-after__grid">
                <div className="before-after__column">
                  <h4>Before</h4>
                  <BeforeAfterColumnGallery
                    urls={group.before_urls}
                    label="Before"
                    itemLabel={itemLabel}
                    groupIndex={index}
                    activeGroup={index === normalizedActiveIndex}
                  />
                </div>
                <div className="before-after__column">
                  <h4>After</h4>
                  <BeforeAfterColumnGallery
                    urls={group.after_urls}
                    label="After"
                    itemLabel={itemLabel}
                    groupIndex={index}
                    activeGroup={index === normalizedActiveIndex}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>

        {safeGroups.length > 1 ? (
          <div className="media-slider__controls">
            <button type="button" className="btn btn--md" onClick={goPrev} aria-label="Previous before and after group">
              Prev
            </button>
            <div className="media-slider__dots" aria-label={`Before and after group ${normalizedActiveIndex + 1} of ${safeGroups.length}`}>
              {safeGroups.map((_, index) => (
                <button
                  key={`before-after-dot-${index}`}
                  type="button"
                  className={`media-slider__dot${index === normalizedActiveIndex ? ' media-slider__dot--active' : ''}`}
                  onClick={() => goTo(index)}
                  aria-label={`Go to before and after group ${index + 1}`}
                  aria-current={index === normalizedActiveIndex ? 'true' : undefined}
                />
              ))}
            </div>
            <button type="button" className="btn btn--md" onClick={goNext} aria-label="Next before and after group">
              Next
            </button>
          </div>
        ) : null}
      </div>
    </PageSection>
  );
}

