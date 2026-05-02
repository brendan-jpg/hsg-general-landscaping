import type { Metadata } from 'next';
import BlockRenderer from '../../components/shared/BlockRenderer';
import TemplatePageRenderer from '@/components/integrations/TemplatePageRenderer';
import { convertBasicBlocksToTemplatePageContent, toTemplatePageContent } from '@/lib/sections/templatePages';
import {
  getActiveArchivePagePaths,
  getActivePageBySlug,
  getActivePageByKind,
  getActiveAreas,
  getFeaturedTestimonials,
  getPrimaryServiceGalleryImages,
  getPublishedBlogPosts,
  getTeamMembers,
} from '@/lib/content/queries';
import { buildBeforeAfterGroups, toBlocks, toServiceProjects } from '@/lib/frontend/content';
import { getActiveServices } from '@/lib/services/queries';
import { getBusiness } from '@/lib/utils/business';
import { buildDynamicMetadata } from '@/lib/utils/seo';

const HOME_SERVICE_GRID_PARENT_ONLY_THRESHOLD = 8;

export async function generateMetadata(): Promise<Metadata> {
  const [business, homePageRecord] = await Promise.all([getBusiness(), getActivePageByKind('home')]);

  return buildDynamicMetadata({
    titleTemplate: homePageRecord?.meta_title,
    descriptionTemplate: homePageRecord?.meta_description,
    fallbackTitle: business?.name?.trim() || homePageRecord?.title || 'Home',
    fallbackDescription: homePageRecord?.meta_description,
    imageUrl: homePageRecord?.og_image_url,
    pathname: '/',
    absoluteTitle: !homePageRecord?.meta_title?.trim(),
  });
}

export default async function HomePage() {
  const [testimonials, services, business, homePageRecord, areas, teamMembers, blogPosts, primaryGallery, archivePaths] = await Promise.all([
    getFeaturedTestimonials(),
    getActiveServices(),
    getBusiness(),
    getActivePageByKind('home'),
    getActiveAreas(),
    getTeamMembers(),
    getPublishedBlogPosts(),
    getPrimaryServiceGalleryImages(12),
    getActiveArchivePagePaths(),
  ]);
  const homeGridServices =
    services.length > HOME_SERVICE_GRID_PARENT_ONLY_THRESHOLD
      ? services.filter((service) => !service.parent_service_id)
      : services;
  const relatedBlogPosts = blogPosts.slice(0, 3);
  const projects = services.flatMap((service) => toServiceProjects(service.service_projects)).slice(0, 6);
  const primaryService = services.find((service) => service.is_primary) ?? services[0] ?? null;
  const beforeAfterGroups = primaryService
    ? buildBeforeAfterGroups(primaryService.before_after_groups)
    : [];
  const galleryImages = primaryGallery.map((image) => ({
    id: image.id,
    file_url: image.file_url,
    caption: image.caption,
  }));
  const homeTemplateContent =
    toTemplatePageContent(homePageRecord?.content) ??
    convertBasicBlocksToTemplatePageContent(homePageRecord?.content, 'home-page-v1', 'Intro');
  const blocks = homeTemplateContent ? [] : toBlocks(homePageRecord?.content);

  return (
    <div className="page page--home">
      {homeTemplateContent ? (
        <TemplatePageRenderer
          content={homeTemplateContent}
          context={{
            page: { title: homePageRecord?.title, metaDescription: homePageRecord?.meta_description },
            business,
            testimonials,
            services: homeGridServices,
            allServices: services,
            serviceAreas: areas,
            teamMembers,
            projects,
            relatedBlogPosts,
            galleryImages,
            beforeAfterGroups,
            archivePaths,
            url: '/',
          }}
        />
      ) : (
        <BlockRenderer blocks={blocks} />
      )}
    </div>
  );
}




