import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import BlockRenderer from '../../../../components/shared/BlockRenderer';
import TemplatePageRenderer from '../../../../components/shared/TemplatePageRenderer';
import AreaProjectsSection from '../../../../components/frontend/AreaProjectsSection';
import { AreaPageHero } from '../../../../components/frontend/DetailPageHeroes';
import FaqListSection from '../../../../components/frontend/FaqListSection';
import {
  BeforeAfterSection,
  GalleryPreviewSection,
  RelatedBlogPostsSection,
  RelatedServicesSection,
  RelatedTestimonialsSection,
} from '@/components/frontend/RelatedContentSections';
import { ProcessSection, TextIntroSection, getDefaultProcessSteps } from '../../../../components/frontend/TemplateSections';
import {
  getActiveAreaBySlug,
  getActiveServicesForArea,
  getActiveTestimonialsForService,
  getGalleryImages,
  getPublicFaqs,
  getPublishedBlogPostsForService,
} from '@/lib/content/queries';
import { toTemplatePageContent } from '@/lib/content/templatePages';
import { buildBeforeAfterGroups, toBlocks, toServiceProjects, type ServiceProject } from '@/lib/frontend/content';
import { buildDynamicMetadata } from '@/lib/utils/seo';

interface AreaProject extends ServiceProject {
  service_title: string;
}

interface Props {
  params: Promise<{ slug: string }>;
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const area = await getActiveAreaBySlug(slug);
  if (!area) return {};

  return buildDynamicMetadata({
    titleTemplate: area.meta_title,
    descriptionTemplate: area.meta_description,
    fallbackTitle: area.name,
    imageUrl: area.featured_image_url,
    pathname: `/areas/${area.slug}`,
    tokens: {
      area: area.name,
      location: area.name,
    },
  });
}

export default async function AreaDetailPage({ params }: Props) {
  const { slug } = await params;
  const area = await getActiveAreaBySlug(slug);
  if (!area) notFound();

  const linkedServices = await getActiveServicesForArea(area.id);
  const serviceIds = linkedServices.map((service) => service.id);

  const [blogGroups, testimonialGroups, galleryGroups, faqGroups] =
    serviceIds.length > 0
      ? await Promise.all([
          Promise.all(serviceIds.map((serviceId) => getPublishedBlogPostsForService(serviceId, 2))),
          Promise.all(serviceIds.map((serviceId) => getActiveTestimonialsForService(serviceId, 2))),
          Promise.all(serviceIds.map((serviceId) => getGalleryImages({ serviceId, limit: 4 }))),
          Promise.all(serviceIds.map((serviceId) => getPublicFaqs({ serviceId }))),
        ])
      : [[], [], [], []];

  const areaProjects: AreaProject[] = linkedServices.flatMap((service) =>
    toServiceProjects(service.service_projects)
      .filter((project) => project.service_area_ids.includes(area.id))
      .map((project) => ({ ...project, service_title: service.title })),
  );
  const relatedBlogPosts = dedupeById(blogGroups.flat()).slice(0, 3);
  const relatedTestimonials = dedupeById(testimonialGroups.flat()).slice(0, 6);
  const relatedGalleryImages = dedupeById(galleryGroups.flat()).slice(0, 12);
  const relatedFaqs = dedupeById(faqGroups.flat()).slice(0, 12).map((faq) => ({
    id: faq.id,
    question: faq.question,
    answer: faq.answer,
  }));
  const relatedBeforeAfterGroups = linkedServices
    .flatMap((service) => buildBeforeAfterGroups(service.before_after_groups, service.before_gallery_urls, service.after_gallery_urls))
    .slice(0, 4);

  const templateContent = toTemplatePageContent(area.content);
  const blocks = templateContent ? [] : toBlocks(area.content);
  const introCopy = `Explore the services we provide in ${area.name}, including related reviews, FAQs, projects, and local work examples.`;
  return (
    <article className="area-detail">
      <AreaPageHero title={area.name} featuredImageUrl={area.featured_image_url} />
      <TextIntroSection title="Intro" body={introCopy} />

      <div className="area-detail__content">
        {templateContent ? <TemplatePageRenderer content={templateContent} /> : <BlockRenderer blocks={blocks} />}
      </div>
      <ProcessSection title="Process" steps={getDefaultProcessSteps('Area')} />

      <RelatedTestimonialsSection testimonials={relatedTestimonials} title="Related Reviews" />
      <FaqListSection items={relatedFaqs} title="Related FAQs" />
      <RelatedBlogPostsSection posts={relatedBlogPosts} title="Related Articles" />
      <AreaProjectsSection areaName={area.name} projects={areaProjects} />
      <GalleryPreviewSection images={relatedGalleryImages} title="Related Gallery" />
      <BeforeAfterSection groups={relatedBeforeAfterGroups} itemLabel={`${area.name} project`} title="Related Before & After" />
      <RelatedServicesSection services={linkedServices} title={`Services in ${area.name}`} />
    </article>
  );
}
