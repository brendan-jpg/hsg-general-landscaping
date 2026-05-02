'use client';

import { useEffect, useRef, useState } from 'react';
import type { Tables } from '../lib/types/database';
import PageSection from './PageSection';

type Testimonial = Tables<'testimonials'>;

interface TestimonialSectionProps {
  testimonials: Testimonial[];
  heading?: string;
  accent?: string;
  lede?: string;
  className?: string;
  serviceNameById?: Record<string, string>;
  areaNameById?: Record<string, string>;
  variant?: 'grid' | 'slider';
  headingAs?: 'h1' | 'h2';
}

const GRID_REVIEW_MAX_CHARS = 220;

function renderStars(rating: number | null | undefined) {
  const safeRating = Math.max(0, Math.min(5, Math.round(rating ?? 0)));
  return `${'\u2605'.repeat(safeRating)}${'\u2606'.repeat(5 - safeRating)}`;
}

function getReviewBadges(
  testimonial: Testimonial,
  serviceNameById: Record<string, string>,
  areaNameById: Record<string, string>,
) {
  const badges: Array<{ key: string; label: string }> = [];
  const serviceId = testimonial.service_id ?? '';
  const serviceName = serviceId ? serviceNameById[serviceId] : '';
  const areaId = testimonial.area_id ?? '';
  const areaName = areaId ? areaNameById[areaId] ?? '' : '';
  if (serviceName) badges.push({ key: 'service', label: serviceName });
  if (areaName) badges.push({ key: 'area', label: areaName });
  return badges;
}

function truncateReviewContent(content: string | null | undefined, maxChars: number) {
  const trimmed = (content ?? '').trim();
  if (!trimmed) return '';
  if (trimmed.length <= maxChars) return trimmed;

  const clipped = trimmed.slice(0, maxChars).trimEnd();
  const lastBreak = Math.max(clipped.lastIndexOf(' '), clipped.lastIndexOf('\n'), clipped.lastIndexOf('\t'));
  const safeClip = lastBreak >= Math.floor(maxChars * 0.6) ? clipped.slice(0, lastBreak).trimEnd() : clipped;
  return `${safeClip}...`;
}

export default function TestimonialSection({
  testimonials,
  heading = 'What Our Customers Say',
  accent = '',
  lede = '',
  className,
  serviceNameById = {},
  areaNameById = {},
  variant = 'slider',
  headingAs = 'h2',
}: TestimonialSectionProps) {
  const trimmedHeading = heading.trim();
  const trimmedAccent = accent.trim();
  const trimmedLede = lede.trim();
  const HeadingTag = headingAs;
  const [current, setCurrent] = useState(0);
  const [stageMinHeight, setStageMinHeight] = useState<number>(0);
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (variant !== 'slider' || testimonials.length === 0) {
      setStageMinHeight(0);
      return;
    }

    function recalculateHeight() {
      if (!sliderRef.current || !measureRef.current) return;

      const visibleSlide = sliderRef.current.querySelector('.testimonials__slide') as HTMLElement | null;
      const targetWidth = visibleSlide?.clientWidth || sliderRef.current.clientWidth;
      if (targetWidth > 0) {
        measureRef.current.style.width = `${targetWidth}px`;
      }

      const cards = Array.from(
        measureRef.current.querySelectorAll<HTMLElement>('.testimonials__measure-slide'),
      );
      if (cards.length === 0) return;

      const tallest = cards.reduce((max, card) => Math.max(max, card.offsetHeight), 0);
      if (tallest > 0) setStageMinHeight(tallest);
    }

    recalculateHeight();
    const timer = window.setTimeout(recalculateHeight, 120);

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && sliderRef.current
        ? new ResizeObserver(() => recalculateHeight())
        : null;
    if (resizeObserver && sliderRef.current) resizeObserver.observe(sliderRef.current);

    window.addEventListener('resize', recalculateHeight);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', recalculateHeight);
      resizeObserver?.disconnect();
    };
  }, [testimonials, variant]);

  if (testimonials.length === 0) return null;

  if (variant === 'grid') {
    return (
      <PageSection heading={heading} accent={accent} lede={lede} className={className} headingAs={headingAs}>
        <div className="reviews__grid auto-grid">
          {testimonials.map((testimonial) => (
            <article key={testimonial.id} className="reviews__card">
              <div className="reviews__stars" aria-label={`${testimonial.rating ?? 0} star review`}>
                {renderStars(testimonial.rating)}
              </div>
              <blockquote className="reviews__quote">
                {truncateReviewContent(testimonial.content, GRID_REVIEW_MAX_CHARS)}
              </blockquote>
              <div className="reviews__author">
                <div className="reviews__author-row">
                  <strong>{testimonial.customer_name}</strong>
                  {((testimonial.service_id && serviceNameById[testimonial.service_id]) || (testimonial.area_id && areaNameById[testimonial.area_id])) ? (
                    <div className="reviews__tags related-reviews__tags--footer">
                      {testimonial.service_id && serviceNameById[testimonial.service_id] ? (
                        <span className="reviews__tag related-reviews__tag--service">
                          {serviceNameById[testimonial.service_id]}
                        </span>
                      ) : null}
                      {testimonial.area_id && areaNameById[testimonial.area_id] ? (
                        <span className="reviews__tag related-reviews__tag--area">{areaNameById[testimonial.area_id]}</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      </PageSection>
    );
  }

  const activeIndex = ((current % testimonials.length) + testimonials.length) % testimonials.length;
  const prevIndex = (activeIndex - 1 + testimonials.length) % testimonials.length;
  const nextIndex = (activeIndex + 1) % testimonials.length;
  const testimonial = testimonials[activeIndex];
  const prevTestimonial = testimonials[prevIndex];
  const nextTestimonial = testimonials[nextIndex];
  const activeBadges = getReviewBadges(testimonial, serviceNameById, areaNameById);

  return (
    <section className={['testimonials', className].filter(Boolean).join(' ')}>
      <div className="testimonials__inner container">
        {trimmedAccent ? <p className="testimonials__accent">{trimmedAccent}</p> : null}
        {trimmedHeading ? <HeadingTag className="testimonials__title">{trimmedHeading}</HeadingTag> : null}
        {trimmedLede ? <p className="testimonials__lede">{trimmedLede}</p> : null}
        <div className="testimonials__slider" ref={sliderRef}>
          <div className="testimonials__measure" ref={measureRef} aria-hidden="true">
            {testimonials.map((item) => (
              <article key={`measure-${item.id}`} className="testimonials__slide testimonials__measure-slide">
                <div className="testimonials__chip">Verified Review</div>
                <div className="testimonials__stars">{renderStars(item.rating)}</div>
                <blockquote className="testimonials__quote">{item.content}</blockquote>
                <div className="testimonials__author">
                  <div className="testimonials__author-row">
                    <span className="testimonials__name">{item.customer_name}</span>
                    {getReviewBadges(item, serviceNameById, areaNameById).length > 0 ? (
                      <div className="testimonials__tags testimonials__tags--footer" aria-hidden="true">
                        {getReviewBadges(item, serviceNameById, areaNameById).map((badge) => (
                          <span key={`${item.id}-${badge.key}`} className={`testimonials__tag testimonials__tag--${badge.key}`}>
                            {badge.label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="testimonials__stage" aria-live="polite" style={stageMinHeight > 0 ? { minHeight: `${stageMinHeight}px` } : undefined}>
            {testimonials.length > 1 && (
              <article className="testimonials__peek testimonials__peek--prev" aria-hidden="true">
                <div className="testimonials__peek-stars">{renderStars(prevTestimonial.rating)}</div>
                <p className="testimonials__peek-quote">{prevTestimonial.content}</p>
                <p className="testimonials__peek-name">{prevTestimonial.customer_name}</p>
              </article>
            )}

            <article className="testimonials__slide" key={testimonial.id}>
              <div className="testimonials__chip">Verified Review</div>
              <div className="testimonials__stars" aria-label={`${testimonial.rating ?? 0} star review`}>
                {renderStars(testimonial.rating)}
              </div>
              <blockquote className="testimonials__quote">{testimonial.content}</blockquote>
              <div className="testimonials__author">
                <div className="testimonials__author-row">
                  <span className="testimonials__name">{testimonial.customer_name}</span>
                  {activeBadges.length > 0 ? (
                    <div className="testimonials__tags testimonials__tags--footer">
                      {activeBadges.map((badge) => (
                        <span key={`${testimonial.id}-${badge.key}`} className={`testimonials__tag testimonials__tag--${badge.key}`}>
                          {badge.label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </article>

            {testimonials.length > 1 && (
              <article className="testimonials__peek testimonials__peek--next" aria-hidden="true">
                <div className="testimonials__peek-stars">{renderStars(nextTestimonial.rating)}</div>
                <p className="testimonials__peek-quote">{nextTestimonial.content}</p>
                <p className="testimonials__peek-name">{nextTestimonial.customer_name}</p>
              </article>
            )}
          </div>
          {testimonials.length > 1 && (
            <div className="testimonials__controls">
              <button
                type="button"
                className="testimonials__nav-btn"
                aria-label="Previous testimonial"
                onClick={() => setCurrent((prev) => (prev - 1 + testimonials.length) % testimonials.length)}
              >
                Prev
              </button>
              <div className="testimonials__dots" role="tablist" aria-label="Testimonials">
                {testimonials.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={index === activeIndex}
                    aria-label={`Go to testimonial ${index + 1}`}
                    className={`testimonials__dot${index === activeIndex ? ' testimonials__dot--active' : ''}`}
                    onClick={() => setCurrent(index)}
                  />
                ))}
              </div>
              <button
                type="button"
                className="testimonials__nav-btn"
                onClick={() => setCurrent((prev) => (prev + 1) % testimonials.length)}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
