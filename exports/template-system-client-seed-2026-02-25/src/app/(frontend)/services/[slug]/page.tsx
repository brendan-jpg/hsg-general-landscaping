import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import BlockRenderer from '../../../../components/shared/BlockRenderer';
import TemplatePageRenderer from '../../../../components/shared/TemplatePageRenderer';
import FaqSection from '../../../../components/frontend/FaqSection';
import { ServicePageHero } from '../../../../components/frontend/DetailPageHeroes';
import { ProcessSection, TextIntroSection, getDefaultProcessSteps } from '../../../../components/frontend/TemplateSections';
import ServiceIcon, { isServiceIconKey } from '@/components/shared/ServiceIcon';
import {
  BeforeAfterSection,
  GalleryPreviewSection,
  RelatedBlogPostsSection,
  RelatedAreasSection,
  RelatedServicesSection,
  RelatedTestimonialsSection,
  ServiceProjectsSection,
} from '@/components/frontend/RelatedContentSections';
import {
  getActiveAreasForService,
  getActiveTestimonialsForService,
  getGalleryImages,
  getPublishedBlogPostsForService,
} from '@/lib/content/queries';
import { toTemplatePageContent } from '@/lib/content/templatePages';
import { buildBeforeAfterGroups, toBlocks, toServiceProjects } from '@/lib/frontend/content';
import { getActiveChildServices, getServiceById, getServiceBySlug } from '@/lib/services/queries';
import { buildDynamicMetadata } from '@/lib/utils/seo';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const service = await getServiceBySlug(slug);
  if (!service) return {};

  return buildDynamicMetadata({
    titleTemplate: service.meta_title,
    descriptionTemplate: service.meta_description,
    fallbackTitle: service.title,
    fallbackDescription: service.excerpt,
    imageUrl: service.featured_image_url,
    pathname: `/services/${service.slug}`,
    tokens: {
      service: service.title,
    },
  });
}

export default async function ServiceDetailPage({ params }: Props) {
  const { slug } = await params;
  const service = await getServiceBySlug(slug);

  if (!service) notFound();

  const [linkedAreas, childServices, parentService, relatedBlogPosts, serviceTestimonials, galleryImages] =
    await Promise.all([
      getActiveAreasForService(service.id),
      getActiveChildServices(service.id),
      service.parent_service_id ? getServiceById(service.parent_service_id) : Promise.resolve(null),
      getPublishedBlogPostsForService(service.id, 3),
      getActiveTestimonialsForService(service.id, 6),
      getGalleryImages({ serviceId: service.id, limit: 12 }),
    ]);

  const parentTestimonials =
    serviceTestimonials.length === 0 && parentService
      ? await getActiveTestimonialsForService(parentService.id, 6)
      : [];
  const relatedTestimonials = serviceTestimonials.length > 0 ? serviceTestimonials : parentTestimonials;
  const usingParentTestimonials = serviceTestimonials.length === 0 && parentTestimonials.length > 0 && Boolean(parentService);

  const templateContent = toTemplatePageContent(service.content);
  const blocks = templateContent ? [] : toBlocks(service.content);
  const beforeAfterGroups = buildBeforeAfterGroups(
    service.before_after_groups,
    service.before_gallery_urls,
    service.after_gallery_urls,
  );
  const serviceProjects = toServiceProjects(service.service_projects);
  const introCopy =
    service.excerpt ||
    `Learn how our ${service.title.toLowerCase()} service works, what to expect, and how we handle projects from quote to completion.`;
  return (
    <article className="service-detail">
      <ServicePageHero
        title={service.title}
        excerpt={service.excerpt}
        featuredImageUrl={service.featured_image_url}
        breadcrumb={
          parentService ? (
            <nav className="service-detail__breadcrumb" aria-label="Breadcrumb">
              <Link href="/services">Services</Link>
              <span>/</span>
              <Link href={`/services/${parentService.slug}`}>{parentService.title}</Link>
            </nav>
          ) : undefined
        }
        icon={isServiceIconKey(service.icon) ? <ServiceIcon name={service.icon} /> : undefined}
      />

      <TextIntroSection title="Intro" body={introCopy} />

      <div className="service-detail__content">
        {templateContent ? <TemplatePageRenderer content={templateContent} /> : <BlockRenderer blocks={blocks} />}
      </div>
      <ProcessSection title="Process" steps={getDefaultProcessSteps('service')} />

      <RelatedServicesSection services={childServices} title={`More ${service.title} Services`} />
      <RelatedBlogPostsSection posts={relatedBlogPosts} />
      <RelatedTestimonialsSection
        testimonials={relatedTestimonials}
        note={
          usingParentTestimonials && parentService
            ? `Showing reviews from ${parentService.title} because this service has no linked reviews yet.`
            : undefined
        }
      />
      <FaqSection
        title="Related FAQs"
        pageType="service"
        serviceId={service.id}
        fallbackServiceId={parentService?.id ?? undefined}
        fallbackNote={
          parentService
            ? `Showing FAQs from ${parentService.title} because this service has no linked FAQs yet.`
            : undefined
        }
      />
      <ServiceProjectsSection projects={serviceProjects} title="Projects" />
      <GalleryPreviewSection images={galleryImages} title="Related Gallery" />
      <BeforeAfterSection groups={beforeAfterGroups} itemLabel={service.title} title="Before & After" />
      <RelatedAreasSection areas={linkedAreas} title={`Areas We Provide ${service.title}`} />
    </article>
  );
}
