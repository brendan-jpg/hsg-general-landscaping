import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import BlockRenderer from '../../../../../components/shared/BlockRenderer';
import TemplatePageRenderer from '../../../../../components/shared/TemplatePageRenderer';
import { ServicePageHero } from '../../../../../components/frontend/DetailPageHeroes';
import FaqSection from '../../../../../components/frontend/FaqSection';
import { ProcessSection, TextIntroSection, getDefaultProcessSteps } from '../../../../../components/frontend/TemplateSections';
import {
  BeforeAfterSection,
  GalleryPreviewSection,
  RelatedBlogPostsSection,
  RelatedAreasSection,
  RelatedTestimonialsSection,
  ServiceProjectsSection,
} from '@/components/frontend/RelatedContentSections';
import {
  getActiveAreasForService,
  getActiveTestimonialsForService,
  getGalleryImages,
  getPublishedBlogPostsForService,
  getAreaComboBySlugs,
} from '@/lib/content/queries';
import { toTemplatePageContent } from '@/lib/content/templatePages';
import { buildBeforeAfterGroups, toBlocks, toServiceProjects } from '@/lib/frontend/content';
import { getServiceById } from '@/lib/services/queries';
import { buildDynamicMetadata } from '@/lib/utils/seo';

interface Props {
  params: Promise<{ slug: string; serviceSlug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, serviceSlug } = await params;
  const result = await getAreaComboBySlugs(slug, serviceSlug);
  if (!result) return {};

  const { area, service, combo } = result;
  return buildDynamicMetadata({
    titleTemplate: combo.meta_title || service.meta_title,
    descriptionTemplate: combo.meta_description || service.meta_description,
    fallbackTitle: `${service.title} in ${area.name}`,
    fallbackDescription: service.excerpt,
    imageUrl: service.featured_image_url || area.featured_image_url,
    pathname: `/areas/${area.slug}/${service.slug}`,
    tokens: {
      service: service.title,
      area: area.name,
      location: area.name,
    },
  });
}

export default async function ComboLandingPage({ params }: Props) {
  const { slug, serviceSlug } = await params;
  const result = await getAreaComboBySlugs(slug, serviceSlug);
  if (!result) notFound();

  const { area, service, combo } = result;
  const serviceProjects = toServiceProjects(service.service_projects).filter(
    (project) => project.service_area_ids.length === 0 || project.service_area_ids.includes(area.id),
  );
  const templateContent = toTemplatePageContent(combo.custom_content ?? service.content);
  const blocks = templateContent ? [] : toBlocks(combo.custom_content ?? service.content);
  const beforeAfterGroups = buildBeforeAfterGroups(
    service.before_after_groups,
    service.before_gallery_urls,
    service.after_gallery_urls,
  );

  const [relatedBlogPosts, serviceTestimonials, parentService, galleryImages, linkedAreas] = await Promise.all([
    getPublishedBlogPostsForService(service.id, 3),
    getActiveTestimonialsForService(service.id, 6),
    service.parent_service_id ? getServiceById(service.parent_service_id) : Promise.resolve(null),
    getGalleryImages({ serviceId: service.id, limit: 12 }),
    getActiveAreasForService(service.id),
  ]);

  const parentTestimonials =
    serviceTestimonials.length === 0 && parentService
      ? await getActiveTestimonialsForService(parentService.id, 6)
      : [];
  const relatedTestimonials = serviceTestimonials.length > 0 ? serviceTestimonials : parentTestimonials;
  const testimonialsFallbackNote =
    serviceTestimonials.length === 0 && parentTestimonials.length > 0 && parentService
      ? `Showing reviews from ${parentService.title} because this service has no linked reviews yet.`
      : undefined;

  const otherAreas = linkedAreas.filter((linkedArea) => linkedArea.id !== area.id);
  const imageUrl = service.featured_image_url || area.featured_image_url;
  const introCopy =
    service.excerpt ||
    `See how we deliver ${service.title.toLowerCase()} in ${area.name}, including local examples, reviews, and FAQs.`;

  return (
    <article className="combo-landing">
      <ServicePageHero
        title={`${service.title} in ${area.name}`}
        excerpt={service.excerpt}
        featuredImageUrl={imageUrl}
        className="combo-landing__header"
        imageClassName="combo-landing__featured-image"
      />
      <TextIntroSection title="Intro" body={introCopy} />

      <div className="combo-landing__content">
        {templateContent ? <TemplatePageRenderer content={templateContent} /> : <BlockRenderer blocks={blocks} />}
      </div>
      <ProcessSection title="Process" steps={getDefaultProcessSteps('Area')} />

      <RelatedTestimonialsSection testimonials={relatedTestimonials} title="Related Reviews" note={testimonialsFallbackNote} />
      <FaqSection title="Related FAQs" pageType="service" serviceId={service.id} />
      <RelatedBlogPostsSection posts={relatedBlogPosts} title="Related Articles" />
      <ServiceProjectsSection projects={serviceProjects} title={`Related Projects in ${area.name}`} />
      <GalleryPreviewSection images={galleryImages} title="Related Gallery" />
      <BeforeAfterSection groups={beforeAfterGroups} itemLabel={`${service.title} in ${area.name}`} title="Related Before & After" />
      <RelatedAreasSection areas={otherAreas} title={`Areas We Provide ${service.title}`} />
    </article>
  );
}
