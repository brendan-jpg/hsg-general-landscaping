import {
  applyFlatImportToTemplatePageContent as upstreamApplyFlatImportToTemplatePageContent,
  convertBasicBlocksToTemplatePageContent as upstreamConvertBasicBlocksToTemplatePageContent,
  createTemplatePageContent as upstreamCreateTemplatePageContent,
  isBasicBlockArrayContent,
  listGlobalSectionCatalog as upstreamListGlobalSectionCatalog,
  listPageTemplates as upstreamListPageTemplates,
  sanitizePageContentForSave,
  sanitizeTemplatePageContent as upstreamSanitizeTemplatePageContent,
  sectionRegistry as upstreamSectionRegistry,
  type BasicBlock,
  type PageTemplateDefinition,
  type SectionDefinition,
  type TemplateFieldBase,
  type TemplateFieldDef,
  type TemplateFieldKind,
  type TemplateSectionSlot,
} from '@/lib/sections-core/templatePages';
import {
  CompatibleTemplatePageContent,
  CompatibleTemplateSectionInstance,
  createExperimentalSectionDefaultsForTemplate,
  dropLegacyServiceGallerySlot,
  insertFieldsAfter,
  listGlobalSectionCatalogFilters,
  normalizeLegacyHeroSections,
  normalizedPageTemplateRegistry,
  normalizeTemplateContentInput,
  normalizeTemplateCreatedSection,
  normalizeTemplateKey,
  preserveCustomSectionFieldValues,
  preserveServiceSectionOrder,
  preserveSharedSectionMetadata,
  removeFields,
} from '@/lib/sections/templatePageCompatibility';
import {
  createExperimentalFlexibleSectionDefaults,
  getAlternatingCanonicalBackgroundTone,
} from '@/lib/sections/canonicalSections';

export { isBasicBlockArrayContent, sanitizePageContentForSave };
export type {
  BasicBlock,
  PageTemplateDefinition,
  SectionDefinition,
  TemplateFieldBase,
  TemplateFieldDef,
  TemplateFieldKind,
  TemplateSectionSlot,
};

export interface TemplateSectionInstance<TData = Record<string, unknown>>
  extends CompatibleTemplateSectionInstance<TData> {}

export interface TemplatePageContent extends CompatibleTemplatePageContent {}

export const sectionRegistry: Record<string, SectionDefinition> = {
  ...upstreamSectionRegistry,
  flexible_form_section: {
    ...upstreamSectionRegistry.flexible_form_section,
    fields: insertFieldsAfter(
      removeFields(upstreamSectionRegistry.flexible_form_section.fields, ['unavailableText']),
      'variant',
      [
        {
          key: 'formColumn',
          label: 'Form Column',
          kind: 'select',
          options: [
            { value: 'content', label: 'Content Column' },
            { value: 'supporting', label: 'Media Column' },
          ],
        },
        {
          key: 'mediaColumn',
          label: 'Media Column',
          kind: 'select',
          options: [
            { value: 'supporting', label: 'Media Column' },
            { value: 'content', label: 'Content Column' },
          ],
        },
      ] as TemplateFieldDef[],
    ),
  },
  flexible_section: {
    ...upstreamSectionRegistry.flexible_section,
    fields: removeFields(upstreamSectionRegistry.flexible_section.fields, ['supportingUnavailableText']),
  },
  flexible_cta_section: {
    ...upstreamSectionRegistry.flexible_cta_section,
    fields: removeFields(upstreamSectionRegistry.flexible_cta_section.fields, ['supportingUnavailableText']),
  },
  flexible_hero_section: {
    ...upstreamSectionRegistry.flexible_hero_section,
    label: 'Hero',
  },
};

export const pageTemplateRegistry: Record<string, PageTemplateDefinition> = normalizedPageTemplateRegistry();

export function listPageTemplates() {
  return upstreamListPageTemplates().map((template) => ({
    ...template,
    slots: pageTemplateRegistry[template.key]?.slots ?? template.slots,
  }));
}

export function listGlobalSectionCatalog() {
  return upstreamListGlobalSectionCatalog()
    .filter((sectionDef) => listGlobalSectionCatalogFilters(sectionDef.type))
    .map((sectionDef) =>
      sectionDef.type === 'flexible_hero_section'
        ? { ...sectionDef, label: 'Hero' }
        : sectionDef,
    );
}

export function createTemplatePageContent(templateKey: string) {
  const content = upstreamCreateTemplatePageContent(normalizeTemplateKey(templateKey));
  const resolvedTemplateKey = content.templateKey;
  const nextContent = {
    ...content,
    templateKey: resolvedTemplateKey,
    sections: (content.templateKey === 'service-content-v1' ? dropLegacyServiceGallerySlot(content.sections) : content.sections)
      .map((section) => normalizeTemplateCreatedSection(section, resolvedTemplateKey)),
  };
  let canonicalToneIndex = 0;
  const sectionsWithAlternatingTones = nextContent.sections.map((section) => {
    const sectionData =
      section.data && typeof section.data === 'object' && !Array.isArray(section.data)
        ? { ...(section.data as Record<string, unknown>) }
        : null;

    if (!sectionData || sectionData.rendererVersion !== 'canonical_v1') {
      return section;
    }

    const nextTone = getAlternatingCanonicalBackgroundTone(canonicalToneIndex);
    canonicalToneIndex += 1;

    return {
      ...section,
      data: {
        ...sectionData,
        backgroundTone: nextTone,
        hasDarkBackground: nextTone === 'dark',
        hasLightBackground: nextTone === 'light',
      },
    };
  });

  return normalizeLegacyHeroSections({
    ...nextContent,
    sections: sectionsWithAlternatingTones.map((section) =>
      section.type === 'flexible_hero_section'
        ? {
            ...section,
            data: {
              ...(createExperimentalSectionDefaultsForTemplate(section.type, resolvedTemplateKey) ??
                createExperimentalFlexibleSectionDefaults(resolvedTemplateKey, true)),
              ...(section.data && typeof section.data === 'object' && !Array.isArray(section.data)
                ? (section.data as Record<string, unknown>)
                : {}),
            },
          }
        : section,
    ),
  });
}

export function sanitizeTemplatePageContent(input: unknown) {
  const normalizedInput = normalizeTemplateContentInput(input);
  const content = upstreamSanitizeTemplatePageContent(normalizedInput) as TemplatePageContent;
  return preserveCustomSectionFieldValues(
    normalizedInput,
    preserveSharedSectionMetadata(
      normalizedInput,
      normalizeLegacyHeroSections(
        preserveServiceSectionOrder(normalizedInput, {
          ...content,
          templateKey: content.templateKey,
        }),
      ),
    ),
  );
}

export function toTemplatePageContent(input: unknown) {
  try {
    return sanitizeTemplatePageContent(input);
  } catch {
    return null;
  }
}

export function convertBasicBlocksToTemplatePageContent(
  input: unknown,
  templateKey: string,
  fallbackHeading = 'Overview',
) {
  return upstreamConvertBasicBlocksToTemplatePageContent(input, normalizeTemplateKey(templateKey), fallbackHeading);
}

export function applyFlatImportToTemplatePageContent(
  content: TemplatePageContent,
  values: Record<string, unknown>,
) {
  return upstreamApplyFlatImportToTemplatePageContent(
    {
      ...content,
      templateKey: normalizeTemplateKey(content.templateKey),
    },
    values,
  );
}
