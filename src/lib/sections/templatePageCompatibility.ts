import {
  pageTemplateRegistry as upstreamPageTemplateRegistry,
  sectionRegistry as upstreamSectionRegistry,
  type PageTemplateDefinition,
  type TemplateFieldDef,
  type TemplatePageContent as UpstreamTemplatePageContent,
  type TemplateSectionInstance as UpstreamTemplateSectionInstance,
  type TemplateSectionSlot,
} from '@/lib/sections-core/templatePages';
import {
  createExperimentalFlexibleSectionDefaults,
  createExperimentalLockedSectionDefaults,
  isCanonicalInsertableSectionType,
  isCanonicalSectionData,
} from '@/lib/sections/canonicalSections';

export interface CompatibleTemplateSectionInstance<TData = Record<string, unknown>>
  extends UpstreamTemplateSectionInstance<TData> {
  sharedSectionId?: string;
  sharedSectionName?: string;
}

export interface CompatibleTemplatePageContent extends Omit<UpstreamTemplatePageContent, 'sections'> {
  sections: CompatibleTemplateSectionInstance[];
}

const TEMPLATE_KEYS_WITH_FLEXIBLE_HEROES = new Set([
  'home-page-v1',
  'content-page-v1',
  'about-page-v1',
  'contact-page-v1',
  'blog-archive-page-v1',
  'services-archive-page-v1',
  'areas-archive-page-v1',
  'service-content-v1',
  'area-content-v1',
  'blog-post-content-v1',
]);

const LEGACY_HERO_SECTION_TYPES = new Set([
  'hero_standard',
  'content_page_header',
  'about_hero_section',
  'contact_hero_section',
  'service_archive_hero_section',
  'service_area_archive_hero_section',
  'blog_archive_hero_section',
  'service_hero_section',
  'service_area_hero_section',
  'blog_hero_section',
]);

const LEGACY_SECTION_TYPE_ALIASES: Record<string, string> = {
  hero_standard: 'hero_standard',
  content_page_header: 'content_page_header',
  service_archive_grid_section: 'service_grid_section',
  services_list_section: 'service_grid_section',
  related_services_section: 'service_grid_section',
  area_archive_grid_section: 'area_grid_section',
  service_area_grid_section: 'area_grid_section',
  related_service_areas_section: 'area_grid_section',
  blog_archive_grid_section: 'blog_grid_section',
  related_blog_posts_section: 'blog_grid_section',
  testimonial_slider_section: 'testimonial_section',
  related_testimonials_section: 'testimonial_section',
  global_faq_section: 'faq_section',
  related_faq_section: 'faq_section',
  faq_list: 'faq_section',
  featured_projects_section: 'projects_section',
  service_projects_section: 'projects_section',
  area_projects_section: 'projects_section',
  service_gallery_section: 'gallery_section',
  related_gallery_section: 'gallery_section',
  process_service_section: 'process_section',
  process_service_area_section: 'process_section',
};

const LEGACY_TYPE_TO_CANONICAL_TYPE: Record<string, string> = {
  home_hero_section: 'flexible_hero_section',
  hero_standard: 'flexible_hero_section',
  about_hero_section: 'flexible_hero_section',
  contact_hero_section: 'flexible_hero_section',
  service_archive_hero_section: 'flexible_hero_section',
  service_area_archive_hero_section: 'flexible_hero_section',
  blog_archive_hero_section: 'flexible_hero_section',
  service_hero_section: 'flexible_hero_section',
  service_area_hero_section: 'flexible_hero_section',
  blog_hero_section: 'flexible_hero_section',
  process_service_section: 'process_section',
  process_service_area_section: 'process_section',
  cta_band: 'flexible_cta_section',
};

export function normalizeTemplateKey(templateKey: string) {
  const normalized = templateKey.trim();
  const legacyAliases: Record<string, string> = {
    'service-page-v1': 'service-content-v1',
    'area-page-v1': 'area-content-v1',
    'blog-post-page-v1': 'blog-post-content-v1',
  };

  return legacyAliases[normalized] ?? normalized;
}

export function preserveSharedSectionMetadata(
  input: unknown,
  content: CompatibleTemplatePageContent,
): CompatibleTemplatePageContent {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return content;

  const record = input as Record<string, unknown>;
  if (record.kind !== 'template-page' || !Array.isArray(record.sections)) return content;

  const rawMetadataById = new Map<string, { sharedSectionId?: string; sharedSectionName?: string }>();

  record.sections.forEach((section) => {
    if (!section || typeof section !== 'object' || Array.isArray(section)) return;
    const sectionRecord = section as Record<string, unknown>;
    const id = typeof sectionRecord.id === 'string' ? sectionRecord.id.trim() : '';
    if (!id) return;

    const sharedSectionId =
      typeof sectionRecord.sharedSectionId === 'string' ? sectionRecord.sharedSectionId.trim() : '';
    const sharedSectionName =
      typeof sectionRecord.sharedSectionName === 'string' ? sectionRecord.sharedSectionName.trim() : '';

    rawMetadataById.set(id, {
      sharedSectionId: sharedSectionId || undefined,
      sharedSectionName: sharedSectionName || undefined,
    });
  });

  if (rawMetadataById.size === 0) return content;

  return {
    ...content,
    sections: content.sections.map((section) => {
      const metadata = rawMetadataById.get(section.id);
      if (!metadata) return section;
      return {
        ...section,
        sharedSectionId: metadata.sharedSectionId,
        sharedSectionName: metadata.sharedSectionName,
      };
    }),
  };
}

export function preserveCustomSectionFieldValues(
  input: unknown,
  content: CompatibleTemplatePageContent,
): CompatibleTemplatePageContent {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return content;

  const record = input as Record<string, unknown>;
  if (record.kind !== 'template-page' || !Array.isArray(record.sections)) return content;

  const rawDataById = new Map<string, Record<string, unknown>>();

  record.sections.forEach((section) => {
    if (!section || typeof section !== 'object' || Array.isArray(section)) return;
    const sectionRecord = section as Record<string, unknown>;
    const id = typeof sectionRecord.id === 'string' ? sectionRecord.id.trim() : '';
    if (!id) return;
    const data =
      sectionRecord.data && typeof sectionRecord.data === 'object' && !Array.isArray(sectionRecord.data)
        ? (sectionRecord.data as Record<string, unknown>)
        : null;
    if (!data) return;
    rawDataById.set(id, data);
  });

  if (rawDataById.size === 0) return content;

  return {
    ...content,
    sections: content.sections.map((section) => {
      const rawData = rawDataById.get(section.id);
      if (!rawData) return section;

      const shouldPreserveExperimentalData =
        isCanonicalSectionData(rawData) &&
        (
          section.type === 'flexible_section' ||
          isCanonicalInsertableSectionType(section.type)
        );

      if (shouldPreserveExperimentalData) {
        const mergedData = {
          ...(section.data && typeof section.data === 'object' && !Array.isArray(section.data)
            ? (section.data as Record<string, unknown>)
            : {}),
          ...rawData,
        };

        return {
          ...section,
          data:
            section.type === 'flexible_hero_section'
              ? normalizeFlexibleHeroDefaultFields(content.templateKey, mergedData)
              : mergedData,
        };
      }

      if (section.type === 'flexible_form_section') {
        const nextData =
          section.data && typeof section.data === 'object' && !Array.isArray(section.data)
            ? { ...(section.data as Record<string, unknown>) }
            : {};

        nextData.formColumn = rawData.formColumn === 'supporting' ? 'supporting' : 'content';
        nextData.mediaColumn = rawData.mediaColumn === 'content' ? 'content' : 'supporting';

        return {
          ...section,
          data: nextData,
        };
      }

      return section;
    }),
  };
}

export function normalizeTemplateSlots(template: PageTemplateDefinition): TemplateSectionSlot[] {
  const filteredSlots =
    template.key !== 'service-content-v1'
      ? template.slots
      : template.slots.filter((slot) => slot.slotId !== 'gallery' && slot.slotId !== 'testimonials');

  if (!TEMPLATE_KEYS_WITH_FLEXIBLE_HEROES.has(template.key)) {
    return filteredSlots;
  }

  return filteredSlots.map((slot) => {
    if (!['hero', 'page_header'].includes(slot.slotId)) return slot;
    return {
      ...slot,
      sectionType: 'flexible_hero_section',
    };
  });
}

export function dropLegacyServiceGallerySlot(sections: CompatibleTemplateSectionInstance[]) {
  return sections.filter(
    (section) =>
      !(
        (section.slotId === 'gallery' && section.type === 'gallery_section') ||
        (section.slotId === 'testimonials' && section.type === 'testimonial_section')
      ),
  );
}

export function createExperimentalSectionDefaultsForTemplate(
  sectionType: string,
  templateKey: string,
): Record<string, unknown> | null {
  if (sectionType === 'flexible_hero_section') {
    return createExperimentalFlexibleSectionDefaults(templateKey, true);
  }

  if (sectionType === 'flexible_cta_section') {
    const defaults = createExperimentalFlexibleSectionDefaults(templateKey, false);
    return {
      ...defaults,
      accent: 'contact',
      heading: 'Get a Quote Today',
      lede: '',
      primaryButton: true,
      secondaryButton: false,
      supportingKind: 'none',
    };
  }

  if (sectionType === 'flexible_form_section') {
    const defaults = createExperimentalFlexibleSectionDefaults(templateKey, false);
    return {
      ...defaults,
      accent: templateKey === 'contact-page-v1' ? 'contact' : defaults.accent,
      heading: templateKey === 'contact-page-v1' ? '{{page}}' : defaults.heading,
      lede: templateKey === 'contact-page-v1' ? '' : defaults.lede,
      supportingKind: 'form',
      primaryButton: false,
      contact_form_id: '',
      unavailableText: 'Form is unavailable right now.',
    };
  }

  if (sectionType === 'service_grid_section') {
    const defaults = createExperimentalLockedSectionDefaults();
    if (templateKey === 'service-content-v1') return { ...defaults, heading: 'Other {{parent_service}} Services' };
    if (templateKey === 'area-content-v1') return { ...defaults, heading: 'Our Services' };
    if (templateKey === 'services-archive-page-v1') return defaults;
    if (templateKey === 'home-page-v1') return { ...defaults, heading: 'Our Services' };
    return defaults;
  }

  if (sectionType === 'area_grid_section') {
    const defaults = createExperimentalLockedSectionDefaults();
    if (templateKey === 'area-content-v1') return { ...defaults, heading: 'Other Service Areas' };
    if (templateKey === 'service-content-v1') return { ...defaults, heading: 'Our {{service}} Service Area' };
    if (templateKey === 'areas-archive-page-v1') return defaults;
    if (templateKey === 'home-page-v1') return { ...defaults, heading: 'Areas We Serve' };
    return defaults;
  }

  if (sectionType === 'blog_grid_section') {
    const defaults = createExperimentalLockedSectionDefaults();
    if (templateKey === 'blog-post-content-v1' || templateKey === 'service-content-v1') {
      return { ...defaults, heading: 'Related Blogs' };
    }
    if (templateKey === 'blog-archive-page-v1') return defaults;
    if (templateKey === 'home-page-v1' || templateKey === 'about-page-v1' || templateKey === 'area-content-v1') {
      return { ...defaults, heading: 'Latest Blogs' };
    }
    return defaults;
  }

  if (sectionType === 'team_grid_section') {
    const defaults = createExperimentalLockedSectionDefaults();
    if (templateKey === 'home-page-v1' || templateKey === 'about-page-v1') {
      return { ...defaults, heading: 'Our Team' };
    }
    return defaults;
  }

  if (sectionType === 'testimonial_section') {
    const defaults = createExperimentalLockedSectionDefaults();
    if (templateKey === 'service-content-v1') return { ...defaults, heading: 'Our Reviews' };
    if (templateKey === 'area-content-v1') return { ...defaults, heading: 'Reviews from Our {{area}} Customers' };
    if (templateKey === 'home-page-v1' || templateKey === 'about-page-v1') return { ...defaults, heading: 'Our Reviews' };
    return defaults;
  }

  if (sectionType === 'faq_section') {
    const defaults = createExperimentalLockedSectionDefaults();
    if (templateKey === 'service-content-v1') return { ...defaults, heading: 'Related {{parent_service}} FAQs' };
    if (templateKey === 'home-page-v1' || templateKey === 'about-page-v1') return { ...defaults, heading: 'FAQs' };
    return defaults;
  }

  if (sectionType === 'projects_section') {
    const defaults = createExperimentalLockedSectionDefaults();
    if (templateKey === 'home-page-v1') return { ...defaults, heading: 'Recent Projects' };
    if (templateKey === 'service-content-v1') return { ...defaults, heading: 'Recent {{service}} Projects' };
    if (templateKey === 'area-content-v1') return { ...defaults, heading: 'Recent Projects in {{area}}' };
    return defaults;
  }

  if (sectionType === 'before_after_section') {
    const defaults = createExperimentalLockedSectionDefaults();
    if (templateKey === 'home-page-v1') return { ...defaults, heading: 'Before & After' };
    if (templateKey === 'service-content-v1') return { ...defaults, heading: '{{service}} Before & After' };
    if (templateKey === 'area-content-v1') return { ...defaults, heading: 'Before & After in {{area}}' };
    return defaults;
  }

  if (sectionType === 'gallery_section') {
    return { ...createExperimentalLockedSectionDefaults(), heading: 'Check Out Our Gallery' };
  }

  if (sectionType === 'process_section') {
    return { ...createExperimentalLockedSectionDefaults(), heading: 'Process' };
  }

  return null;
}

export function normalizeTemplateCreatedSection(
  section: CompatibleTemplateSectionInstance,
  templateKey: string,
): CompatibleTemplateSectionInstance {
  const nextType = LEGACY_TYPE_TO_CANONICAL_TYPE[section.type] ?? section.type;
  const defaults = createExperimentalSectionDefaultsForTemplate(nextType, templateKey);
  if (!defaults && nextType === section.type) return section;

  return {
    ...section,
    type: nextType,
    data: defaults ?? section.data,
  };
}

function getDefaultFlexibleHeroData(templateKey: string): Record<string, unknown> {
  const defaults = upstreamSectionRegistry.flexible_hero_section.createDefaultData() as Record<string, unknown>;

  if (templateKey === 'home-page-v1') {
    return {
      ...defaults,
      accent: '{{business}}',
      heading: '{{primary_service}} in {{primary_area}}, {{state_code}}',
      supportingKind: 'none',
      useContextFeaturedImage: false,
      useContextIcon: false,
    };
  }

  if (templateKey === 'service-content-v1') {
    return {
      ...defaults,
      accent: '{{business}}',
      heading: '{{service}}',
      supportingKind: 'image',
      useContextFeaturedImage: true,
      useContextIcon: true,
    };
  }

  if (templateKey === 'area-content-v1') {
    return {
      ...defaults,
      accent: '{{business}}',
      heading: '{{area}}',
      supportingKind: 'image',
      useContextFeaturedImage: true,
      useContextIcon: true,
    };
  }

  if (templateKey === 'blog-post-content-v1') {
    return {
      ...defaults,
      accent: '{{business}}',
      heading: '{{post}}',
      supportingKind: 'image',
      useContextFeaturedImage: true,
      useContextIcon: false,
    };
  }

  return {
    ...defaults,
    accent: '{{business}}',
    heading: '{{page}}',
    supportingKind: 'none',
    useContextFeaturedImage: false,
    useContextIcon: false,
  };
}

function normalizeFlexibleHeroDefaultFields(
  templateKey: string,
  data: Record<string, unknown>,
): Record<string, unknown> {
  if (templateKey !== 'home-page-v1') return data;

  const nextData = { ...data };
  const rawHeading = typeof nextData.heading === 'string' ? nextData.heading.trim() : '';
  const rawAccent = typeof nextData.accent === 'string' ? nextData.accent.trim() : '';

  if (!rawHeading || rawHeading === '{{page}}') {
    nextData.heading = '{{primary_service}} in {{primary_area}}, {{state_code}}';
  }

  if (!rawAccent) {
    nextData.accent = '{{business}}';
  }

  return nextData;
}

function mapLegacyHeroLayoutToFlexible(layout: string) {
  if (layout === 'split' || layout === 'feature') return 'two_column_text_left';
  return 'one_column';
}

export function normalizeLegacyHeroSections(content: CompatibleTemplatePageContent): CompatibleTemplatePageContent {
  if (!TEMPLATE_KEYS_WITH_FLEXIBLE_HEROES.has(content.templateKey)) {
    return content;
  }

  const defaults = getDefaultFlexibleHeroData(content.templateKey);

  return {
    ...content,
    sections: content.sections.map((section) => {
      if (!LEGACY_HERO_SECTION_TYPES.has(section.type)) return section;

      const rawData =
        section.data && typeof section.data === 'object' && !Array.isArray(section.data)
          ? (section.data as Record<string, unknown>)
          : {};
      const rawLayout = typeof rawData.layout === 'string' ? rawData.layout.trim() : '';
      const rawVariant = typeof rawData.variant === 'string' ? rawData.variant.trim() : '';

      return {
        ...section,
        type: 'flexible_hero_section',
        data: normalizeFlexibleHeroDefaultFields(content.templateKey, {
          ...defaults,
          accent: typeof rawData.accent === 'string' ? rawData.accent.trim() : '',
          heading:
            typeof rawData.heading === 'string' && rawData.heading.trim() ? rawData.heading.trim() : defaults.heading,
          lede: typeof rawData.lede === 'string' ? rawData.lede.trim() : '',
          layout: mapLegacyHeroLayoutToFlexible(rawLayout),
          variant: rawVariant || defaults.variant,
        }),
      };
    }),
  };
}

export function insertFieldsAfter(
  fields: TemplateFieldDef[],
  afterKey: string,
  nextFields: TemplateFieldDef[],
) {
  const filteredFields = fields.filter(
    (field) => !nextFields.some((nextField) => nextField.key === field.key),
  );
  const index = filteredFields.findIndex((field) => field.key === afterKey);
  if (index < 0) return [...filteredFields, ...nextFields];
  return [
    ...filteredFields.slice(0, index + 1),
    ...nextFields,
    ...filteredFields.slice(index + 1),
  ];
}

export function removeFields(fields: TemplateFieldDef[], keys: string[]) {
  return fields.filter((field) => !keys.includes(field.key));
}

export function listGlobalSectionCatalogFilters(sectionType: string) {
  return ![
    'hero_standard',
    'home_hero_section',
    'about_hero_section',
    'contact_hero_section',
    'service_archive_hero_section',
    'service_area_archive_hero_section',
    'blog_archive_hero_section',
    'service_hero_section',
    'service_area_hero_section',
    'blog_hero_section',
  ].includes(sectionType);
}

export function normalizeTemplateContentInput(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;

  const record = input as Record<string, unknown>;
  if (record.kind !== 'template-page') return input;

  const templateKey = normalizeTemplateKey(typeof record.templateKey === 'string' ? record.templateKey : '');

  const normalizedSections = Array.isArray(record.sections)
    ? record.sections
        .map((section) => {
          if (!section || typeof section !== 'object' || Array.isArray(section)) return section;
          const sectionRecord = section as Record<string, unknown>;
          const rawType = typeof sectionRecord.type === 'string' ? sectionRecord.type.trim() : '';
          const normalizedType = LEGACY_SECTION_TYPE_ALIASES[rawType] ?? rawType;
          return normalizedType === rawType ? section : { ...sectionRecord, type: normalizedType };
        })
        .filter((section) => {
          if (templateKey !== 'service-content-v1') return true;
          if (!section || typeof section !== 'object' || Array.isArray(section)) return true;
          const sectionRecord = section as Record<string, unknown>;
          return !(
            sectionRecord.slotId === 'gallery' &&
            (typeof sectionRecord.type !== 'string' || sectionRecord.type.trim() === 'gallery_section')
          );
        })
    : record.sections;

  return {
    ...record,
    templateKey,
    sections: normalizedSections,
  };
}

export function preserveServiceSectionOrder(
  input: unknown,
  content: CompatibleTemplatePageContent,
): CompatibleTemplatePageContent {
  if (content.templateKey !== 'service-content-v1') return content;
  if (!input || typeof input !== 'object' || Array.isArray(input)) return content;

  const record = input as Record<string, unknown>;
  if (record.kind !== 'template-page' || !Array.isArray(record.sections)) return content;

  const rawOrderById = new Map<string, number>();
  record.sections.forEach((section, index) => {
    if (!section || typeof section !== 'object' || Array.isArray(section)) return;
    const sectionRecord = section as Record<string, unknown>;
    const sectionId = typeof sectionRecord.id === 'string' ? sectionRecord.id.trim() : '';
    if (!sectionId) return;
    rawOrderById.set(sectionId, index);
  });

  if (rawOrderById.size === 0) return content;

  return {
    ...content,
    sections: dropLegacyServiceGallerySlot(content.sections)
      .map((section, index) => ({ section, index }))
      .sort((a, b) => {
        const aOrder = rawOrderById.get(a.section.id) ?? Number.MAX_SAFE_INTEGER;
        const bOrder = rawOrderById.get(b.section.id) ?? Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.index - b.index;
      })
      .map(({ section }) => section),
  };
}

export function normalizedPageTemplateRegistry() {
  return Object.fromEntries(
    Object.entries(upstreamPageTemplateRegistry).map(([key, template]) => [
      key,
      {
        ...template,
        slots: normalizeTemplateSlots(template),
      },
    ]),
  ) as Record<string, PageTemplateDefinition>;
}
