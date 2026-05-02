import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import TemplatePageRenderer from '@/components/integrations/TemplatePageRenderer';
import StructuredData from '@/components/shared/StructuredData';
import { buildBeforeAfterGroups, toServiceProjects, type ServiceProject } from '@/lib/frontend/content';
import {
  getActiveArchivePagePaths,
  getActiveAreaBySlug,
  getActiveAreas,
  getActiveTestimonials,
  getActiveTestimonialsForArea,
  getFeaturedTestimonials,
  getGalleryImages,
  getPublishedBlogPosts,
  getPublishedBlogPostsForService,
} from '@/lib/content/queries';
import { convertBasicBlocksToTemplatePageContent, toTemplatePageContent, type TemplatePageContent } from '@/lib/sections/templatePages';
import { getActiveChildServices, getActiveServices, getServiceById, getServiceBySlug } from '@/lib/services/queries';
import { buildAreaPath, buildServicePath } from '@/lib/utils/publicPaths';
import { getBusiness } from '@/lib/utils/business';
import { buildAreaSchema, buildServiceSchema } from '@/lib/utils/schema';
import { buildDynamicMetadata } from '@/lib/utils/seo';

type GalleryImage = { id: string; file_url: string; caption: string | null };

interface AreaProject extends ServiceProject {
  service_title: string;
}

function dedupeGalleryImages(images: GalleryImage[]) {
  return images.filter(
    (image, index, allImages) =>
      typeof image.file_url === 'string' &&
      image.file_url.trim().length > 0 &&
      allImages.findIndex((candidate) => candidate.file_url === image.file_url) === index,
  );
}

function countRhythmImagesUsedByLongForm(content: TemplatePageContent | null, availableImageCount: number) {
  if (!content || availableImageCount <= 0) return 0;
  const longFormSection = content.sections.find((section) => section.type === 'long_form_body_section');
  if (!longFormSection) return 0;

  const blocks = Array.isArray(longFormSection.data?.blocks)
    ? longFormSection.data.blocks.filter(
        (block): block is { type: string; data: Record<string, unknown> } =>
          Boolean(block) && typeof block === 'object' && !Array.isArray(block) && typeof (block as { type?: unknown }).type === 'string',
      )
    : [];

  const anchorIndexes = blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block, index }) => ['heading', 'paragraph', 'list', 'quote', 'html'].includes(block.type) && index < blocks.length - 1)
    .map(({ index }) => index);

  if (anchorIndexes.length < 3) return 0;
  return Math.min(availableImageCount, Math.floor(anchorIndexes.length / 3), 3);
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export async function generateServiceDetailMetadataBySlug(slug: string): Promise<Metadata> {
  const service = await getServiceBySlug(slug);
  if (!service) return {};

  const business = await getBusiness();
  return buildDynamicMetadata({
    titleTemplate: service.meta_title,
    descriptionTemplate: service.meta_description,
    fallbackTitle: service.title,
    fallbackDescription: service.excerpt,
    imageUrl: service.featured_image_url,
    pathname: buildServicePath(service.slug ?? slug, business?.settings),
    tokens: {
      service: service.title,
    },
  });
}

export async function renderServiceDetailPageBySlug(slug: string) {
  const service = await getServiceBySlug(slug);
  if (!service) notFound();

  const [serviceAreas, childServices, parentService, relatedBlogPosts, galleryImages, services, business, anyTestimonials, archivePaths] =
    await Promise.all([
      getActiveAreas(),
      getActiveChildServices(service.id),
      service.parent_service_id ? getServiceById(service.parent_service_id) : Promise.resolve(null),
      getPublishedBlogPostsForService(service.id, 3),
      getGalleryImages({ limit: 24 }),
      getActiveServices(),
      getBusiness(),
      getFeaturedTestimonials(),
      getActiveArchivePagePaths(),
    ]);

  const familyRootId = service.parent_service_id ?? service.id;
  const familyServiceIds = services
    .filter((candidate) => (candidate.parent_service_id ?? candidate.id) === familyRootId)
    .map((candidate) => candidate.id);
  const familyTestimonials = await getActiveTestimonials({ serviceIds: familyServiceIds, limit: 6 });
  const hasFamilyTestimonials = familyTestimonials.length > 0;
  const relatedTestimonials = hasFamilyTestimonials ? familyTestimonials : anyTestimonials;

  const isParentService = !service.parent_service_id;
  const childProjectItems = isParentService ? childServices.flatMap((child) => toServiceProjects(child.service_projects)) : [];
  const serviceProjects = Array.from(
    new Map(
      [...toServiceProjects(service.service_projects), ...childProjectItems].map((project) => [
        `${project.title}|${project.summary}|${project.photo_urls[0] ?? ''}`,
        project,
      ]),
    ).values(),
  );

  const ownBeforeAfterGroups = buildBeforeAfterGroups(service.before_after_groups);
  const childBeforeAfterGroups = isParentService ? childServices.flatMap((child) => buildBeforeAfterGroups(child.before_after_groups)) : [];
  const beforeAfterGroups = [...ownBeforeAfterGroups, ...childBeforeAfterGroups];
  const ownServiceGalleryUrls = Array.isArray(service.service_gallery_urls)
    ? service.service_gallery_urls.filter((item): item is string => typeof item === 'string')
    : [];
  const childServiceGalleryUrls = isParentService
    ? childServices.flatMap((child) =>
        Array.isArray(child.service_gallery_urls)
          ? child.service_gallery_urls.filter((item): item is string => typeof item === 'string')
          : [],
      )
    : [];
  const serviceGalleryUrls = Array.from(new Set([...ownServiceGalleryUrls, ...childServiceGalleryUrls]));
  const serviceGalleryUrlSet = new Set(serviceGalleryUrls);
  const serviceGalleryImages = serviceGalleryUrls.map((fileUrl, index) => ({
    id: `service-gallery-${service.id}-${index}`,
    file_url: fileUrl,
    caption: null,
  }));

  const templateContent =
    toTemplatePageContent(service.content) ??
    convertBasicBlocksToTemplatePageContent(service.content, 'service-content-v1', `${service.title} Services`);
  const orderedGalleryImages = dedupeGalleryImages(
    serviceGalleryImages.length > 0
      ? serviceGalleryImages
      : galleryImages
          .filter((image) => !serviceGalleryUrlSet.has(image.file_url))
          .map((image) => ({
            id: image.id,
            file_url: image.file_url,
            caption: image.caption ?? null,
          })),
  );
  const rhythmImages = orderedGalleryImages.slice(0, countRhythmImagesUsedByLongForm(templateContent, orderedGalleryImages.length));
  const gallerySectionImages = orderedGalleryImages.slice(rhythmImages.length);
  const pathname = buildServicePath(service.slug ?? slug, business?.settings);
  const serviceSchema = buildServiceSchema({
    business,
    title: service.title,
    description: service.meta_description || service.excerpt,
    imageUrl: service.featured_image_url,
    pathname,
  });

  return (
    <div className="page page--service service">
      <StructuredData data={serviceSchema} />
      {templateContent ? (
        <TemplatePageRenderer
          content={templateContent}
          context={{
            service,
            business,
            services,
            serviceAreas,
            testimonials: relatedTestimonials,
            hasFamilyTestimonials,
            parentService,
            childServices,
            relatedBlogPosts,
            projects: serviceProjects,
            galleryImages: orderedGalleryImages,
            rhythmImages,
            gallerySectionImages,
            beforeAfterGroups,
            archivePaths,
            url: pathname,
          }}
        />
      ) : null}
    </div>
  );
}

export async function generateAreaDetailMetadataBySlug(slug: string): Promise<Metadata> {
  const area = await getActiveAreaBySlug(slug);
  if (!area) return {};

  const business = await getBusiness();
  return buildDynamicMetadata({
    titleTemplate: area.meta_title,
    descriptionTemplate: area.meta_description,
    fallbackTitle: area.name,
    imageUrl: area.featured_image_url,
    pathname: buildAreaPath(area.slug ?? slug, business?.settings),
    tokens: {
      area: area.name,
      location: area.name,
    },
  });
}

export async function renderAreaDetailPageBySlug(slug: string) {
  const area = await getActiveAreaBySlug(slug);
  if (!area) notFound();

  const [business, allAreas, allServices, blogPosts, areaTestimonials, featuredTestimonials, galleryImages, archivePaths] = await Promise.all([
    getBusiness(),
    getActiveAreas(),
    getActiveServices(),
    getPublishedBlogPosts(),
    getActiveTestimonialsForArea(area.id, 6),
    getFeaturedTestimonials(),
    getGalleryImages({ limit: 12 }),
    getActiveArchivePagePaths(),
  ]);
  const areaProjects: AreaProject[] = allServices.flatMap((service) =>
    toServiceProjects(service.service_projects)
      .filter((project) => project.area_ids.includes(area.id))
      .map((project) => ({ ...project, service_title: service.title })),
  );
  const relatedBlogPosts = blogPosts.slice(0, 3);
  const relatedTestimonials = areaTestimonials.length > 0 ? areaTestimonials : featuredTestimonials.slice(0, 6);
  const galleryImagesForPage = dedupeById(galleryImages).slice(0, 12);
  const beforeAfterGroups = allServices
    .flatMap((service) => buildBeforeAfterGroups(service.before_after_groups))
    .filter((group) => group.area_ids.includes(area.id))
    .slice(0, 4);
  const templateContent =
    toTemplatePageContent(area.content) ??
    convertBasicBlocksToTemplatePageContent(area.content, 'area-content-v1', `Services in ${area.name}`);
  const pathname = buildAreaPath(area.slug ?? slug, business?.settings);
  const areaSchema = buildAreaSchema({
    business,
    areaName: area.name,
    description: area.meta_description,
    pathname,
  });

  return (
    <div className="page page--area area">
      <StructuredData data={areaSchema} />
      {templateContent ? (
        <TemplatePageRenderer
          content={templateContent}
          context={{
            area,
            business,
            services: allServices,
            serviceAreas: allAreas,
            testimonials: relatedTestimonials,
            relatedBlogPosts,
            galleryImages: galleryImagesForPage,
            projects: areaProjects,
            beforeAfterGroups,
            archivePaths,
            url: pathname,
          }}
        />
      ) : null}
    </div>
  );
}
