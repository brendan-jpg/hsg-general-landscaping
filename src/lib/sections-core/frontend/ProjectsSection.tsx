'use client';

import { useEffect, useMemo, useState } from 'react';
import AppImage from '../components/shared/AppImage';
import type { ServiceProject } from '../lib/frontend/content';
import PageSection from './PageSection';

type AreaProject = ServiceProject & {
  service_title?: string;
};

interface ProjectsSectionProps {
  projects: AreaProject[];
  areaName?: string;
  heading?: string;
  accent?: string;
  lede?: string;
  className?: string;
  autoPlayMs?: number;
  headingAs?: 'h1' | 'h2';
}

export default function ProjectsSection({
  projects,
  areaName,
  heading = 'Projects',
  accent,
  lede,
  className,
  autoPlayMs = 3500,
  headingAs = 'h2',
}: ProjectsSectionProps) {
  const projectPhotoSizes = '(max-width: 575px) calc(100vw - 2rem), (max-width: 991px) calc(50vw - 1rem), calc(25vw - 1rem)';
  const HeadingTag = headingAs;
  const hasAreaProjectMeta = projects.some((project) => typeof project.service_title === 'string' && project.service_title.trim().length > 0);
  const [activeIndex, setActiveIndex] = useState(0);
  const safeProjects = useMemo(
    () => projects.filter((project) => project.photo_urls.length > 0 || project.title || project.summary),
    [projects],
  );

  useEffect(() => {
    if (safeProjects.length <= 1) return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % safeProjects.length);
    }, autoPlayMs);

    return () => window.clearInterval(timer);
  }, [autoPlayMs, safeProjects.length]);

  if (projects.length === 0 || safeProjects.length === 0) return null;

  const normalizedActiveIndex = ((activeIndex % safeProjects.length) + safeProjects.length) % safeProjects.length;

  const goTo = (index: number) => {
    setActiveIndex(index);
  };

  const goPrev = () => {
    setActiveIndex((current) => (current - 1 + safeProjects.length) % safeProjects.length);
  };

  const goNext = () => {
    setActiveIndex((current) => (current + 1) % safeProjects.length);
  };

  if (!hasAreaProjectMeta) {
    return (
      <PageSection heading={heading} accent={accent} lede={lede} className={className} headingAs={headingAs}>
        <div className="media-slider" aria-roledescription="carousel" aria-label="Project gallery slider">
          <div
            className="media-slider__track"
            style={{ transform: `translateX(-${normalizedActiveIndex * 100}%)` }}
          >
            {safeProjects.map((project, projectIndex) => {
              const title = project.title?.trim() || '';
              const summary = project.summary?.trim() || '';
              const hasProjectCopy = Boolean(title || summary);
              const previewPhotos = project.photo_urls.slice(0, 4);
              const remainingPhotoCount = Math.max(0, project.photo_urls.length - previewPhotos.length);

              return (
                <article
                  key={`${title || 'project'}-${projectIndex}`}
                  className={[
                    'projects-list__card',
                    'media-slider__slide',
                    hasProjectCopy ? '' : 'projects-list__card--media-only',
                  ].filter(Boolean).join(' ')}
                >
                  {hasProjectCopy ? (
                    <div className="projects-list__copy">
                      {title ? <h3>{title}</h3> : null}
                      {summary ? <p>{summary}</p> : null}
                    </div>
                  ) : null}
                  {previewPhotos.length > 0 ? (
                    <div className="projects-list__media">
                      <div className={`media-grid projects-list__photos projects-list__photos--${Math.min(previewPhotos.length, 4)}`}>
                        {previewPhotos.map((url, photoIndex) => {
                          const isLastVisible = photoIndex === previewPhotos.length - 1;
                          const showOverflow = remainingPhotoCount > 0 && isLastVisible;
                          return (
                            <div key={`${projectIndex}-${url}-${photoIndex}`} className="media-grid__item projects-list__photo">
                              <AppImage
                                role="gallery"
                                src={url}
                                alt={`${title || 'Project'} photo ${photoIndex + 1}`}
                                width={900}
                                height={675}
                                priority={projectIndex === normalizedActiveIndex && photoIndex === 0}
                                sizes={projectPhotoSizes}
                              />
                              {showOverflow && <span className="area-projects__photo-more">+{remainingPhotoCount}</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          {safeProjects.length > 1 ? (
            <div className="media-slider__controls">
              <button type="button" className="btn btn--md" onClick={goPrev} aria-label="Previous project">
                Prev
              </button>
              <div className="media-slider__dots" aria-label={`Project ${normalizedActiveIndex + 1} of ${safeProjects.length}`}>
                {safeProjects.map((_, index) => (
                  <button
                    key={`project-dot-${index}`}
                    type="button"
                    className={`media-slider__dot${index === normalizedActiveIndex ? ' media-slider__dot--active' : ''}`}
                    onClick={() => goTo(index)}
                    aria-label={`Go to project ${index + 1}`}
                    aria-current={index === normalizedActiveIndex ? 'true' : undefined}
                  />
                ))}
              </div>
              <button type="button" className="btn btn--md" onClick={goNext} aria-label="Next project">
                Next
              </button>
            </div>
          ) : null}
        </div>
      </PageSection>
    );
  }

  const totalPhotos = safeProjects.reduce((sum, project) => sum + project.photo_urls.length, 0);

  return (
    <section className={['area-projects', className].filter(Boolean).join(' ')} aria-labelledby="area-projects-heading">
      <div className="area-projects__inner container">
        <div className="area-projects__head">
          <div>
            <HeadingTag id="area-projects-heading">{heading?.trim() || `Projects in ${areaName || 'this area'}`}</HeadingTag>
            {accent ? <p className="area-projects__accent">{accent}</p> : null}
            {lede ? <p className="area-projects__lede">{lede}</p> : null}
            <p className="area-projects__meta">
              {safeProjects.length} project{safeProjects.length === 1 ? '' : 's'}
              {totalPhotos > 0 ? ` - ${totalPhotos} photo${totalPhotos === 1 ? '' : 's'}` : ''}
            </p>
          </div>
        </div>

        <div className="media-slider" aria-roledescription="carousel" aria-label="Project slider">
          <div
            className="media-slider__track"
            style={{ transform: `translateX(-${normalizedActiveIndex * 100}%)` }}
          >
            {safeProjects.map((project, projectIndex) => {
              const previewPhotos = project.photo_urls.slice(0, 4);
              const remainingPhotoCount = Math.max(0, project.photo_urls.length - previewPhotos.length);
              const title = project.title?.trim() || '';
              const summary = project.summary?.trim() || '';
              const serviceTitle = project.service_title?.trim() || '';
              const hasProjectCopy = Boolean(serviceTitle || title || summary);
              const projectKeyTitle = title || `project-${projectIndex + 1}`;

              return (
                <article
                  key={`${project.service_title || 'project'}-${projectKeyTitle}-${projectIndex}`}
                  className={[
                    'area-projects__card',
                    'media-slider__slide',
                    hasProjectCopy ? '' : 'area-projects__card--media-only',
                  ].filter(Boolean).join(' ')}
                >
                  <div className="area-projects__card-head">
                    {hasProjectCopy ? (
                      <div className="area-projects__copy">
                        {serviceTitle ? <p className="area-projects__service">{serviceTitle}</p> : null}
                        {title ? <h3>{title}</h3> : null}
                        {summary ? <p className="area-projects__summary">{summary}</p> : null}
                      </div>
                    ) : null}
                    <div className="area-projects__badges" aria-label="Project details">
                      <span className="area-projects__badge">
                        {project.photo_urls.length} photo{project.photo_urls.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  </div>

                  {previewPhotos.length > 0 && (
                    <div className="area-projects__media">
                      <div className={`media-grid area-projects__photos area-projects__photos--${Math.min(previewPhotos.length, 4)}`}>
                        {previewPhotos.map((url, photoIndex) => {
                          const isLastVisible = photoIndex === previewPhotos.length - 1;
                          const showOverflow = remainingPhotoCount > 0 && isLastVisible;
                          return (
                            <div key={`${projectIndex}-${url}-${photoIndex}`} className="media-grid__item area-projects__photo">
                              <AppImage
                                role="gallery"
                                src={url}
                                alt={`${title || 'Project'} photo ${photoIndex + 1}`}
                                width={900}
                                height={675}
                                priority={projectIndex === normalizedActiveIndex && photoIndex === 0}
                                sizes={projectPhotoSizes}
                              />
                              {showOverflow && <span className="area-projects__photo-more">+{remainingPhotoCount}</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {safeProjects.length > 1 ? (
            <div className="media-slider__controls">
              <button type="button" className="btn btn--md" onClick={goPrev} aria-label="Previous project">
                Prev
              </button>
              <div className="media-slider__dots" aria-label={`Project ${normalizedActiveIndex + 1} of ${safeProjects.length}`}>
                {safeProjects.map((_, index) => (
                  <button
                    key={`area-project-dot-${index}`}
                    type="button"
                    className={`media-slider__dot${index === normalizedActiveIndex ? ' media-slider__dot--active' : ''}`}
                    onClick={() => goTo(index)}
                    aria-label={`Go to project ${index + 1}`}
                    aria-current={index === normalizedActiveIndex ? 'true' : undefined}
                  />
                ))}
              </div>
              <button type="button" className="btn btn--md" onClick={goNext} aria-label="Next project">
                Next
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
