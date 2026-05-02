import { setSectionsRuntime } from '@/lib/sections-core/lib/runtime';
import {
  getGalleryImages,
  getPrimaryServiceFeaturedImage,
  getPrimaryServiceGalleryImages,
  getPublicFaqs,
  getPublicMediaImages,
} from '@/lib/content/queries';
import { toServiceProjects } from '@/lib/frontend/content';
import { getActiveServices } from '@/lib/services/queries';
import { getBusiness } from '@/lib/utils/business';
import { toStateCode } from '@/lib/content/comboSlugs';

let initialized = false;

export function initializeSectionsServerRuntime() {
  if (initialized) return;
  setSectionsRuntime({
    queries: {
      getPrimaryServiceFeaturedImage,
      getPrimaryServiceGalleryImages,
      getGalleryImages,
      getPublicFaqs,
      getPublicMediaImages,
      getActiveServices,
    },
    business: {
      getBusiness,
    },
    transforms: {
      toStateCode,
      toServiceProjects,
    },
  });
  initialized = true;
}


