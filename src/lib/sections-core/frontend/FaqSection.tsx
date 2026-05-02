import { getSectionsRuntime } from '../lib/runtime';

interface FaqSectionProps {
  global?: boolean;
  heading?: string;
  accent?: string;
  lede?: string;
  pageType?: string;
  pageId?: string;
  serviceId?: string;
  fallbackServiceId?: string;
  fallbackNote?: string;
  className?: string;
  headingAs?: 'h1' | 'h2';
}

export default async function FaqSection({
  global,
  heading,
  accent,
  lede,
  pageType,
  pageId,
  serviceId,
  fallbackServiceId,
  fallbackNote,
  className,
  headingAs = 'h2',
}: FaqSectionProps) {
  const HeadingTag = headingAs;
  const runtime = getSectionsRuntime();
  const faqs = await runtime.queries.getPublicFaqs({ global, pageType, pageId, serviceId });
  const primaryServiceFeaturedImage = await runtime.queries.getPrimaryServiceFeaturedImage();
  const shouldUseFallback = faqs.length === 0 && Boolean(serviceId && fallbackServiceId);
  const fallbackFaqs = shouldUseFallback
    ? await runtime.queries.getPublicFaqs({ global, pageType, pageId, serviceId: fallbackServiceId })
    : [];
  const finalFaqs = faqs.length > 0 ? faqs : fallbackFaqs;
  const imageServiceId = faqs.length > 0 ? serviceId : shouldUseFallback ? fallbackServiceId : serviceId;

  const primaryServiceGalleryImages = await runtime.queries.getPrimaryServiceGalleryImages(3);

  const contextualGalleryImages =
    primaryServiceGalleryImages.length === 0
      ? await runtime.queries.getGalleryImages(imageServiceId ? { serviceId: imageServiceId, limit: 3 } : { limit: 3 })
      : [];

  const images =
    primaryServiceGalleryImages.length > 0
      ? primaryServiceGalleryImages
      : contextualGalleryImages.length > 0
        ? contextualGalleryImages
        : await runtime.queries.getPublicMediaImages({ limit: 3 });

  if (finalFaqs.length === 0) return null;

  return (
    <section className={['faq', className].filter(Boolean).join(' ')}>
      <div className="faq__layout container">
        {heading || primaryServiceFeaturedImage?.file_url ? (
          <div className="faq__media">
            {heading ? <HeadingTag className="faq__title">{heading}</HeadingTag> : null}
            {accent ? <p className="faq__accent">{accent}</p> : null}
            {primaryServiceFeaturedImage?.file_url ? (
              <img
                className="faq__media-image"
                src={primaryServiceFeaturedImage.file_url}
                alt={primaryServiceFeaturedImage.caption?.trim() || ''}
                loading="lazy"
              />
            ) : null}
          </div>
        ) : null}
        {lede || (shouldUseFallback && fallbackFaqs.length > 0 ? fallbackNote : undefined) ? (
          <p className="faq__lede">{lede || (shouldUseFallback && fallbackFaqs.length > 0 ? fallbackNote : undefined)}</p>
        ) : null}
        <div className="faq__list">
          {finalFaqs.map((faq, index) => (
            <details key={faq.id} className="faq__item">
              <summary className="faq__question">
                <span className="faq__question-index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="faq__question-text">{faq.question}</span>
                <span className="faq__toggle" aria-hidden="true">+</span>
              </summary>
              <div className="faq__answer">
                <div className="faq__answer-inner">{faq.answer}</div>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}


