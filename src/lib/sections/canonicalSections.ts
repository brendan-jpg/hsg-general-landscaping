import type { TemplateFieldDef } from '@/lib/sections-core/templatePages';

export const CANONICAL_RENDERER_VERSION = 'canonical_v1';

export const CANONICAL_INSERTABLE_SECTION_TYPES = [
  'flexible_hero_section',
  'flexible_cta_section',
  'flexible_form_section',
  'service_grid_section',
  'area_grid_section',
  'blog_grid_section',
  'team_grid_section',
  'gallery_section',
  'projects_section',
  'before_after_section',
  'faq_section',
  'testimonial_section',
  'process_section',
] as const;

export const CANONICAL_LOCKED_SECTION_TYPES = [
  'service_grid_section',
  'area_grid_section',
  'blog_grid_section',
  'team_grid_section',
  'gallery_section',
  'projects_section',
  'before_after_section',
  'faq_section',
  'testimonial_section',
  'process_section',
] as const;

export const CANONICAL_SECTION_TYPES = [
  'flexible_section',
  'flexible_hero_section',
  'flexible_cta_section',
  'flexible_form_section',
  ...CANONICAL_LOCKED_SECTION_TYPES,
] as const;

export type CanonicalInsertableSectionType = (typeof CANONICAL_INSERTABLE_SECTION_TYPES)[number];
export type CanonicalLockedSectionType = (typeof CANONICAL_LOCKED_SECTION_TYPES)[number];
export type CanonicalSectionType = (typeof CANONICAL_SECTION_TYPES)[number];

export function isCanonicalInsertableSectionType(value: string): value is CanonicalInsertableSectionType {
  return (CANONICAL_INSERTABLE_SECTION_TYPES as readonly string[]).includes(value);
}

export function isCanonicalLockedSectionType(value: string): value is CanonicalLockedSectionType {
  return (CANONICAL_LOCKED_SECTION_TYPES as readonly string[]).includes(value);
}

export function usesCanonicalSectionSystem(value: string): value is CanonicalSectionType {
  return (CANONICAL_SECTION_TYPES as readonly string[]).includes(value);
}

export function getAlternatingCanonicalBackgroundTone(index: number) {
  return index % 2 === 0 ? 'light' : 'dark';
}

export function normalizeCanonicalContentLayout(value: string) {
  const layout = value.trim();
  if (
    layout === 'block' ||
    layout === 'stack_2_text_top' ||
    layout === 'stack_2_text_bottom' ||
    layout === 'row_2_text_left' ||
    layout === 'row_2_text_right'
  ) {
    return layout;
  }

  if (layout === 'stack_2') return 'stack_2_text_top';
  if (layout === 'row_2' || layout === 'two_column_text_left') return 'row_2_text_left';
  if (layout === 'two_column_text_right') return 'row_2_text_right';
  return 'block';
}

export function isCanonicalSectionData(value: unknown) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      (value as { rendererVersion?: unknown }).rendererVersion === CANONICAL_RENDERER_VERSION,
  );
}

function buildVariantFields(): TemplateFieldDef[] {
  return [
    { key: 'isCentered', label: 'Centered', kind: 'boolean' },
    { key: 'hasBackgroundImage', label: 'BG Image', kind: 'boolean' },
    { key: 'hasBackgroundVideo', label: 'BG Video', kind: 'boolean' },
  ];
}

function buildStyleFields(): TemplateFieldDef[] {
  return [
    {
      key: 'backgroundTone',
      label: 'Background Tone',
      kind: 'select',
      options: [
        { value: 'none', label: 'None' },
        { value: 'dark', label: 'Dark BG' },
        { value: 'light', label: 'Light BG' },
      ],
    },
    {
      key: 'backgroundPattern',
      label: 'Background Pattern',
      kind: 'select',
      options: [
        { value: 'none', label: 'None' },
        { value: 'pattern_1', label: 'BG Pattern 1' },
        { value: 'pattern_2', label: 'BG Pattern 2' },
        { value: 'pattern_3', label: 'BG Pattern 3' },
      ],
    },
  ];
}

export const CANONICAL_CONTENT_SECTION_FIELDS: TemplateFieldDef[] = [
  {
    key: 'layout',
    label: 'Layout',
    kind: 'select',
    options: [
      { value: 'block', label: 'Block' },
      { value: 'stack_2_text_top', label: 'Stack 2 - Text Top' },
      { value: 'stack_2_text_bottom', label: 'Stack 2 - Text Bottom' },
      { value: 'row_2_text_left', label: 'Row 2 - Text Left' },
      { value: 'row_2_text_right', label: 'Row 2 - Text Right' },
    ],
  },
  { key: 'isCentered', label: 'Centered', kind: 'boolean' },
  ...buildStyleFields(),
  { key: 'accent', label: 'Accent', kind: 'text' },
  { key: 'heading', label: 'Heading', kind: 'text' },
  { key: 'lede', label: 'Lede', kind: 'textarea' },
  { key: 'contentBlocks', label: 'Content Blocks', kind: 'blocks' },
  { key: 'supportingKind', label: 'Supporting', kind: 'text' },
  { key: 'supportingParagraph', label: 'Paragraph', kind: 'textarea' },
  { key: 'primaryButton', label: 'Primary Btn', kind: 'boolean' },
  { key: 'secondaryButton', label: 'Secondary Btn', kind: 'boolean' },
  { key: 'useContextIcon', label: 'Use Current Icon', kind: 'boolean' },
  { key: 'iconValue', label: 'Icon', kind: 'text' },
  { key: 'useContextFeaturedImage', label: 'Use Current Image', kind: 'boolean' },
  { key: 'supportingImage', label: 'Image', kind: 'image' },
  { key: 'supportingVideoUrl', label: 'Video', kind: 'url' },
  { key: 'supportingFormId', label: 'Form', kind: 'select', optionsKey: 'contact_form_id' },
  { key: 'backgroundImageUrl', label: 'BG Image Asset', kind: 'image' },
  { key: 'backgroundVideoUrl', label: 'BG Video Asset', kind: 'url' },
];

export const CANONICAL_SECTION_FIELDS: TemplateFieldDef[] = [
  {
    key: 'layout',
    label: 'Layout',
    kind: 'select',
    options: [
      { value: 'stack', label: 'Stack' },
      { value: 'two_column_text_left', label: '2 Col - Text Left' },
      { value: 'two_column_text_right', label: '2 Col - Text Right' },
    ],
  },
  ...buildVariantFields(),
  ...buildStyleFields(),
  { key: 'accent', label: 'Accent', kind: 'text' },
  { key: 'heading', label: 'Heading', kind: 'text' },
  { key: 'lede', label: 'Lede', kind: 'textarea' },
  { key: 'contentBlocks', label: 'Content Blocks', kind: 'blocks' },
  { key: 'supportingKind', label: 'Supporting', kind: 'text' },
  { key: 'supportingParagraph', label: 'Paragraph', kind: 'textarea' },
  { key: 'primaryButton', label: 'Primary Btn', kind: 'boolean' },
  { key: 'secondaryButton', label: 'Secondary Btn', kind: 'boolean' },
  { key: 'useContextIcon', label: 'Use Current Icon', kind: 'boolean' },
  { key: 'iconValue', label: 'Icon', kind: 'text' },
  { key: 'useContextFeaturedImage', label: 'Use Current Image', kind: 'boolean' },
  { key: 'supportingImage', label: 'Image', kind: 'image' },
  { key: 'supportingVideoUrl', label: 'Video', kind: 'url' },
  { key: 'supportingFormId', label: 'Form', kind: 'select', optionsKey: 'contact_form_id' },
  { key: 'backgroundImageUrl', label: 'BG Image Asset', kind: 'image' },
  { key: 'backgroundVideoUrl', label: 'BG Video Asset', kind: 'url' },
];

export const CANONICAL_LOCKED_SECTION_FIELDS: TemplateFieldDef[] = [
  ...buildVariantFields(),
  ...buildStyleFields(),
  { key: 'accent', label: 'Accent', kind: 'text' },
  { key: 'heading', label: 'Heading', kind: 'text' },
  { key: 'lede', label: 'Lede', kind: 'textarea' },
];

function baseExperimentalData() {
  return {
    rendererVersion: CANONICAL_RENDERER_VERSION,
    isCentered: false,
    backgroundTone: 'light',
    backgroundPattern: 'none',
    hasDarkBackground: false,
    hasLightBackground: false,
    hasBackgroundImage: false,
    hasBackgroundVideo: false,
    backgroundImageUrl: '',
    backgroundVideoUrl: '',
    accent: '',
    heading: '',
    lede: '',
  };
}

export function createExperimentalFlexibleSectionDefaults(templateKey?: string, hero = false) {
  const isHomeTemplate = templateKey === 'home-page-v1';
  const isServiceTemplate = templateKey === 'service-content-v1';
  const isAreaTemplate = templateKey === 'area-content-v1';
  const isBlogTemplate = templateKey === 'blog-post-content-v1';

  return {
    ...baseExperimentalData(),
    layout: hero ? 'two_column_text_left' : 'stack',
    contentBlocks: [],
    supportingKind: hero ? 'image' : 'none',
    supportingParagraph: '',
    primaryButton: hero,
    secondaryButton: false,
    useContextIcon: isServiceTemplate || isAreaTemplate,
    iconValue: '',
    useContextFeaturedImage: hero && (isServiceTemplate || isAreaTemplate || isBlogTemplate),
    supportingImage: '',
    supportingVideoUrl: '',
    supportingFormId: '',
    accent: hero ? '{{business}}' : '',
    heading: isHomeTemplate && hero
      ? '{{primary_service}} in {{primary_area}}, {{state_code}}'
      : isServiceTemplate
        ? '{{service}}'
        : isAreaTemplate
          ? '{{area}}'
          : isBlogTemplate
            ? '{{post}}'
            : '{{page}}',
  };
}

export function createExperimentalLockedSectionDefaults() {
  return baseExperimentalData();
}

export function getExperimentalInsertableLabel(sectionType: string, fallbackLabel: string) {
  const labelByType: Record<string, string> = {
    flexible_hero_section: 'Hero',
    flexible_cta_section: 'CTA',
    flexible_form_section: 'Form',
    service_grid_section: 'Services Grid',
    area_grid_section: 'Areas Grid',
    blog_grid_section: 'Blog Grid',
    team_grid_section: 'Team Grid',
    gallery_section: 'Gallery',
    projects_section: 'Projects',
    before_after_section: 'Before & After',
    faq_section: 'FAQs',
    testimonial_section: 'Reviews',
    process_section: 'Process',
  };

  return labelByType[sectionType] ?? fallbackLabel;
}
