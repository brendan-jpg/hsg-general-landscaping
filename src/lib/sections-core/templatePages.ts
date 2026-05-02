export type TemplateFieldKind =
  | 'text'
  | 'textarea'
  | 'markdown'
  | 'blocks'
  | 'image'
  | 'url'
  | 'select'
  | 'boolean'
  | 'number'
  | 'group'
  | 'list';

export interface TemplateFieldBase {
  key: string;
  label: string;
  kind: TemplateFieldKind;
  required?: boolean;
}

export interface TemplateTextField extends TemplateFieldBase {
  kind: 'text' | 'textarea' | 'url' | 'markdown' | 'select';
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  optionsKey?: string;
}

export interface TemplateBooleanField extends TemplateFieldBase {
  kind: 'boolean';
}

export interface TemplateNumberField extends TemplateFieldBase {
  kind: 'number';
  min?: number;
  max?: number;
  step?: number;
}

export interface TemplateGroupField extends TemplateFieldBase {
  kind: 'group';
  fields: TemplateFieldDef[];
}

export interface TemplateListField extends TemplateFieldBase {
  kind: 'list';
  itemLabel: string;
  itemSchema: TemplateGroupField | TemplateTextField;
  minItems?: number;
  maxItems?: number;
}

export interface TemplateBlocksField extends TemplateFieldBase {
  kind: 'blocks';
}

export interface TemplateImageField extends TemplateFieldBase {
  kind: 'image';
}

export type TemplateFieldDef =
  | TemplateTextField
  | TemplateBooleanField
  | TemplateNumberField
  | TemplateGroupField
  | TemplateListField
  | TemplateBlocksField
  | TemplateImageField;

export interface SectionDefinition<TData = Record<string, unknown>> {
  type: string;
  label: string;
  fields: TemplateFieldDef[];
  createDefaultData: () => TData;
  sanitizeData: (input: unknown) => TData;
  importAliases?: Record<string, string>;
}

export interface TemplateSectionSlot {
  slotId: string;
  label: string;
  sectionType: string;
  required: boolean;
  clientCanEdit: boolean;
  clientCanHide?: boolean;
  description?: string;
}

export interface PageTemplateDefinition {
  key: string;
  label: string;
  slots: TemplateSectionSlot[];
  editorMode?: 'locked-slots' | 'flexible-sections';
}

export interface TemplateSectionInstance<TData = Record<string, unknown>> {
  id: string;
  slotId: string;
  type: string;
  data: TData;
  hidden?: boolean;
}

export interface TemplatePageContent {
  kind: 'template-page';
  version: 1;
  templateKey: string;
  sections: TemplateSectionInstance[];
}

export interface BasicBlock {
  type: string;
  data: Record<string, unknown>;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function asBoolean(value: unknown) {
  return value === true;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function toStringList(value: unknown) {
  return asArray(value)
    .map((item) => asString(item).trim())
    .filter(Boolean);
}

function generateId() {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `section-${Math.random().toString(36).slice(2, 10)}`;
}

type HeroStandardData = {
  accent: string;
  heading: string;
  lede: string;
  primaryCta: { text: string; href: string };
};

type RichTextSectionData = {
  variant: RichTextSectionVariant;
  accent: string;
  heading: string;
  lede: string;
  image: string;
};
type TwoColumnContentVariant = 'media_right' | 'media_left';
type TwoColumnContentSectionData = {
  variant: TwoColumnContentVariant;
  accent: string;
  heading: string;
  lede: string;
  image: string;
};
type ListSectionVariant = 'unordered' | 'ordered';
type ListSectionItem = {
  title: string;
  body: string;
};
type ListSectionData = {
  variant: ListSectionVariant;
  accent: string;
  heading: string;
  lede: string;
  items: ListSectionItem[];
};
type TableSectionRow = {
  cells: string[];
};
type TableSectionData = {
  accent: string;
  heading: string;
  lede: string;
  columns: string[];
  rows: TableSectionRow[];
};

type LongFormBodySectionData = {
  blocks: BasicBlock[];
};

type SharedSectionLayout = 'default' | 'split' | 'feature';
type SharedSectionVariant = 'default' | 'boxed' | 'minimal' | 'contrast';
type CtaBandData = {
  layout: SharedSectionLayout;
  variant: SharedSectionVariant;
  accent: string;
  heading: string;
  lede: string;
};
type FlexibleCtaSectionData = {
  layout: FlexibleSectionLayout;
  variant: string;
  ctaType: string;
  accent: string;
  heading: string;
  lede: string;
  primaryButton: boolean;
  secondaryButton: boolean;
  contentBlocks: BasicBlock[];
  supportingKind: 'none' | 'image' | 'video' | 'form';
  supportingImage: string;
  supportingImageAlt: string;
  supportingVideoUrl: string;
  supportingFormId: string;
  supportingUnavailableText: string;
};
type FlexibleHeroSectionData = {
  layout: FlexibleSectionLayout;
  variant: string;
  accent: string;
  heading: string;
  lede: string;
  primaryButton: boolean;
  secondaryButton: boolean;
  contentBlocks: BasicBlock[];
  supportingKind: 'none' | 'image' | 'video' | 'form';
  useContextFeaturedImage: boolean;
  supportingImage: string;
  supportingImageAlt: string;
  supportingVideoUrl: string;
  supportingFormId: string;
  supportingUnavailableText: string;
};

type ProcessSectionStep = {
  heading: string;
  lede: string;
};
type ProcessSectionData = {
  accent: string;
  heading: string;
  lede: string;
  steps: ProcessSectionStep[];
};
type LogosSectionLogo = {
  image: string;
  alt: string;
  label: string;
  href: string;
};
type LogosSectionData = {
  accent: string;
  heading: string;
  lede: string;
  logos: LogosSectionLogo[];
};
type SectionTextData = { accent: string; heading: string; lede: string };
type OwnerSpotlightSectionData = {
  heading: string;
  lede: string;
  profileAccent: string;
  profileBody: string;
};
type PageHeroData = { layout: SharedSectionLayout; variant: SharedSectionVariant; accent: string; heading: string; lede: string };
type HomeHeroSectionData = {
  layout: SharedSectionLayout;
  variant: SharedSectionVariant;
  accent: string;
  heading: string;
  lede: string;
  primaryCtaText: string;
  primaryCtaHref: string;
  secondaryCtaText: string;
  secondaryCtaHref: string;
};
type QuoteSectionData = { accent: string; heading: string; lede: string; quote: string; attribution: string };
type DetailHeroTextData = { layout: SharedSectionLayout; variant: SharedSectionVariant; accent: string; heading: string; lede: string };
type ServiceHeroData = { layout: SharedSectionLayout; variant: SharedSectionVariant; accent: string; heading: string; lede: string };
type AreaHeroData = { layout: SharedSectionLayout; variant: SharedSectionVariant; accent: string; heading: string; lede: string };
type FormSectionData = { accent: string; heading: string; lede: string; contact_form_id: string; unavailableText: string };
type RichTextSectionVariant = 'default' | 'split' | 'feature';
type FlexibleSectionLayout = 'one_column' | 'two_column_text_left' | 'two_column_text_right';
type FlexibleSectionSupportingKind = 'none' | 'blocks' | 'image' | 'video' | 'form' | 'logos';
type FlexibleSectionLogo = {
  image: string;
  alt: string;
  label: string;
  href: string;
};
type FlexibleSectionData = {
  layout: FlexibleSectionLayout;
  variant: string;
  accent: string;
  heading: string;
  lede: string;
  primaryButton: boolean;
  secondaryButton: boolean;
  contentBlocks: BasicBlock[];
  supportingKind: FlexibleSectionSupportingKind;
  useContextFeaturedImage: boolean;
  supportingBlocks: BasicBlock[];
  supportingImage: string;
  supportingImageAlt: string;
  supportingVideoUrl: string;
  supportingFormId: string;
  supportingUnavailableText: string;
  logos: FlexibleSectionLogo[];
};
type FlexibleFormSectionData = {
  layout: FlexibleSectionLayout;
  variant: string;
  accent: string;
  heading: string;
  lede: string;
  primaryButton: boolean;
  secondaryButton: boolean;
  contentBlocks: BasicBlock[];
  contact_form_id: string;
  unavailableText: string;
  supportingImage: string;
  supportingImageAlt: string;
};


function createEmptyLongFormBodySectionData(): LongFormBodySectionData {
  return { blocks: [] };
}

function sanitizeSectionTextData(input: unknown, fallbackHeading = '', fallbackLede = ''): SectionTextData {
  const obj = asObject(input);
  return {
    accent: asString(obj.accent).trim(),
    heading: asString(obj.heading).trim() || fallbackHeading,
    lede: asString(obj.lede).trim() || fallbackLede,
  };
}

function sanitizeLogosSectionData(input: unknown, fallbackHeading = '', fallbackLede = ''): LogosSectionData {
  const base = sanitizeSectionTextData(input, fallbackHeading, fallbackLede);
  const obj = asObject(input);
  const logos = asArray(obj.logos)
    .map((item) => {
      const logo = asObject(item);
      return {
        image: asString(logo.image).trim(),
        alt: asString(logo.alt).trim(),
        label: asString(logo.label).trim(),
        href: asString(logo.href).trim(),
      };
    })
    .filter((logo) => logo.image.length > 0 || logo.label.length > 0 || logo.alt.length > 0 || logo.href.length > 0);

  return {
    ...base,
    logos,
  };
}

function sanitizeSharedSectionLayout(input: unknown): SharedSectionLayout {
  return input === 'split' || input === 'feature' ? input : 'default';
}

function sanitizeSharedSectionVariant(input: unknown): SharedSectionVariant {
  return input === 'boxed' || input === 'minimal' || input === 'contrast' ? input : 'default';
}

function sanitizeLegacyLayoutValue(input: unknown): SharedSectionLayout {
  return sanitizeSharedSectionLayout(input);
}

function readSharedLayout(obj: Record<string, unknown>): SharedSectionLayout {
  const explicitLayout = sanitizeSharedSectionLayout(obj.layout);
  if (explicitLayout !== 'default' || asString(obj.layout).trim() === 'default') return explicitLayout;
  return sanitizeLegacyLayoutValue(obj.variant);
}

function readSharedVariant(obj: Record<string, unknown>): SharedSectionVariant {
  const rawVariant = asString(obj.variant).trim();
  if (rawVariant === 'default' || rawVariant === 'boxed' || rawVariant === 'minimal' || rawVariant === 'contrast') {
    return sanitizeSharedSectionVariant(rawVariant);
  }
  return 'default';
}

function sanitizeDetailHeroTextData(input: unknown): DetailHeroTextData {
  const obj = asObject(input);
  return {
    layout: readSharedLayout(obj),
    variant: readSharedVariant(obj),
    ...sanitizeSectionTextData(input),
  };
}

function sanitizePageHeroData(input: unknown, fallbackHeading = '{{page}}'): PageHeroData {
  const obj = asObject(input);
  return {
    layout: readSharedLayout(obj),
    variant: readSharedVariant(obj),
    ...sanitizeSectionTextData(input, fallbackHeading),
  };
}

function sanitizeServiceHeroData(input: unknown): ServiceHeroData {
  const obj = asObject(input);
  const text = sanitizeSectionTextData(input);
  return {
    layout: readSharedLayout(obj),
    variant: readSharedVariant(obj),
    ...text,
  };
}

function sanitizeHomeHeroData(input: unknown): HomeHeroSectionData {
  const obj = asObject(input);
  return {
    layout: readSharedLayout(obj),
    variant: readSharedVariant(obj),
    accent: asString(obj.accent).trim(),
    heading: asString(obj.heading).trim(),
    lede: asString(obj.lede).trim(),
    primaryCtaText: asString(obj.primaryCtaText).trim(),
    primaryCtaHref: asString(obj.primaryCtaHref).trim(),
    secondaryCtaText: asString(obj.secondaryCtaText).trim(),
    secondaryCtaHref: asString(obj.secondaryCtaHref).trim(),
  };
}

function sanitizeRichTextSectionVariant(input: unknown): RichTextSectionVariant {
  return input === 'split' || input === 'feature' ? input : 'default';
}

function sanitizeRichTextSectionData(input: unknown): RichTextSectionData {
  const obj = asObject(input);
  const text = sanitizeSectionTextData(input);
  return {
    variant: sanitizeRichTextSectionVariant(obj.variant),
    ...text,
    image: asString(obj.image).trim(),
  };
}

function sanitizeTwoColumnContentVariant(input: unknown): TwoColumnContentVariant {
  return input === 'media_left' ? 'media_left' : 'media_right';
}

function sanitizeTwoColumnContentSectionData(input: unknown): TwoColumnContentSectionData {
  const obj = asObject(input);
  const text = sanitizeSectionTextData(input);
  return {
    variant: sanitizeTwoColumnContentVariant(obj.variant),
    ...text,
    image: asString(obj.image).trim(),
  };
}

function sanitizeFlexibleSectionLayout(input: unknown): FlexibleSectionLayout {
  return input === 'two_column_text_left' || input === 'two_column_text_right'
    ? input
    : 'one_column';
}

function sanitizeFlexibleSectionSupportingKind(input: unknown): FlexibleSectionSupportingKind {
  return input === 'blocks' || input === 'image' || input === 'video' || input === 'form' || input === 'logos'
    ? input
    : 'none';
}

function sanitizeFlexibleSectionData(input: unknown): FlexibleSectionData {
  const obj = asObject(input);
  return {
    layout: sanitizeFlexibleSectionLayout(obj.layout),
    variant: asString(obj.variant).trim(),
    ...sanitizeSectionTextData(input),
    primaryButton:
      asBoolean(obj.primaryButton) ||
      (asString(obj.primaryButtonLabel).trim().length > 0 && asString(obj.primaryButtonHref).trim().length > 0),
    secondaryButton:
      asBoolean(obj.secondaryButton) ||
      (asString(obj.secondaryButtonLabel).trim().length > 0 && asString(obj.secondaryButtonHref).trim().length > 0),
    contentBlocks: sanitizeBasicBlocks(obj.contentBlocks),
    supportingKind: sanitizeFlexibleSectionSupportingKind(obj.supportingKind),
    useContextFeaturedImage: asBoolean(obj.useContextFeaturedImage),
    supportingBlocks: sanitizeBasicBlocks(obj.supportingBlocks),
    supportingImage: asString(obj.supportingImage).trim(),
    supportingImageAlt: asString(obj.supportingImageAlt).trim(),
    supportingVideoUrl: asString(obj.supportingVideoUrl).trim(),
    supportingFormId: asString(obj.supportingFormId).trim(),
    supportingUnavailableText: asString(obj.supportingUnavailableText).trim(),
    logos: asArray(obj.logos)
      .map((item) => {
        const logo = asObject(item);
        return {
          image: asString(logo.image).trim(),
          alt: asString(logo.alt).trim(),
          label: asString(logo.label).trim(),
          href: asString(logo.href).trim(),
        };
      })
      .filter((logo) => logo.image.length > 0 || logo.label.length > 0 || logo.alt.length > 0 || logo.href.length > 0),
  };
}

function sanitizeFlexibleFormSectionData(input: unknown): FlexibleFormSectionData {
  const obj = asObject(input);
  return {
    layout: sanitizeFlexibleSectionLayout(obj.layout),
    variant: asString(obj.variant).trim(),
    ...sanitizeSectionTextData(input),
    primaryButton:
      asBoolean(obj.primaryButton) ||
      (asString(obj.primaryButtonLabel).trim().length > 0 && asString(obj.primaryButtonHref).trim().length > 0),
    secondaryButton:
      asBoolean(obj.secondaryButton) ||
      (asString(obj.secondaryButtonLabel).trim().length > 0 && asString(obj.secondaryButtonHref).trim().length > 0),
    contentBlocks: sanitizeBasicBlocks(obj.contentBlocks),
    contact_form_id: asString(obj.contact_form_id).trim(),
    unavailableText: asString(obj.unavailableText).trim(),
    supportingImage: asString(obj.supportingImage).trim(),
    supportingImageAlt: asString(obj.supportingImageAlt).trim(),
  };
}

function sanitizeListSectionVariant(input: unknown): ListSectionVariant {
  return input === 'ordered' ? 'ordered' : 'unordered';
}

function sanitizeListSectionItem(input: unknown): ListSectionItem {
  const obj = asObject(input);
  return {
    title: asString(obj.title).trim(),
    body: asString(obj.body).trim(),
  };
}

function sanitizeListSectionData(input: unknown): ListSectionData {
  const obj = asObject(input);
  const text = sanitizeSectionTextData(input);
  return {
    variant: sanitizeListSectionVariant(obj.variant),
    ...text,
    items: asArray(obj.items)
      .map((item) => sanitizeListSectionItem(item))
    .filter((item) => item.title.length > 0 || item.body.length > 0),
  };
}

function getDefaultProcessSectionSteps(kind: 'home' | 'service' | 'serviceArea' | 'about'): ProcessSectionStep[] {
  if (kind === 'home') {
    return [
      { heading: 'Reach Out', lede: 'Tell us what you need and share the key details of your project.' },
      { heading: 'Plan & Quote', lede: 'We review the scope, confirm options, and outline the next steps.' },
      { heading: 'Complete the Work', lede: 'Our team handles the job with clear communication throughout.' },
      { heading: 'Final Walkthrough', lede: 'We review the results and make sure everything is wrapped up right.' },
    ];
  }

  if (kind === 'serviceArea') {
    return [
      { heading: 'Contact Our Team', lede: 'Request service and let us know your location and project goals.' },
      { heading: 'Confirm Coverage', lede: 'We confirm availability in your area and recommend the right service path.' },
      { heading: 'Schedule Service', lede: 'We lock in a time window that works and prepare for the visit.' },
      { heading: 'Deliver & Follow Up', lede: 'We complete the work and review the outcome with you.' },
    ];
  }

  if (kind === 'about') {
    return [
      { heading: 'Listen First', lede: 'We start by understanding your goals, timeline, and priorities.' },
      { heading: 'Set Expectations', lede: 'You get clear communication on scope, scheduling, and what comes next.' },
      { heading: 'Do the Work Right', lede: 'We focus on workmanship, safety, and a clean professional process.' },
      { heading: 'Stand Behind It', lede: 'We follow through and stay available after the project is complete.' },
    ];
  }

  return [
    { heading: 'Request a Quote', lede: 'Share a few details so we can understand the scope of your service needs.' },
    { heading: 'Schedule the Visit', lede: 'We coordinate timing and confirm what to expect on the day of service.' },
    { heading: 'Complete the Service', lede: 'Our team performs the work and keeps you informed during the job.' },
    { heading: 'Review the Result', lede: 'We walk through the completed work and answer any final questions.' },
  ];
}

function sanitizeProcessSectionStep(input: unknown): ProcessSectionStep {
  const obj = asObject(input);
  return {
    heading: asString(obj.heading).trim(),
    lede: asString(obj.lede).trim(),
  };
}

function sanitizeProcessSectionData(
  input: unknown,
  kind: 'home' | 'service' | 'serviceArea' | 'about',
): ProcessSectionData {
  const obj = asObject(input);
  const text = sanitizeSectionTextData(input, 'Process');
  const defaultSteps = getDefaultProcessSectionSteps(kind);
  const steps = asArray(obj.steps)
    .map((step) => sanitizeProcessSectionStep(step))
    .filter((step) => step.heading.length > 0 || step.lede.length > 0);

  return {
    ...text,
    steps: steps.length > 0 ? steps : defaultSteps,
  };
}

function sanitizeTableRow(input: unknown): TableSectionRow {
  const obj = asObject(input);
  return {
    cells: toStringList(obj.cells),
  };
}

function sanitizeTableSectionData(input: unknown): TableSectionData {
  const obj = asObject(input);
  const text = sanitizeSectionTextData(input);
  const columns = toStringList(obj.columns);
  const rows = asArray(obj.rows)
    .map((row) => sanitizeTableRow(row))
    .filter((row) => row.cells.length > 0);

  return {
    ...text,
    columns,
    rows,
  };
}

function sanitizeAreaHeroData(input: unknown): AreaHeroData {
  const obj = asObject(input);
  const text = sanitizeSectionTextData(input);
  return {
    layout: readSharedLayout(obj),
    variant: readSharedVariant(obj),
    ...text,
  };
}

function sanitizeCtaBandData(input: unknown): CtaBandData {
  const obj = asObject(input);
  return {
    layout: readSharedLayout(obj),
    variant: readSharedVariant(obj),
    accent: asString(obj.accent).trim() || 'contact',
    heading: asString(obj.heading).trim() || 'Get a Quote Today',
    lede: asString(obj.lede).trim(),
  };
}

function sanitizeFlexibleCtaSectionData(input: unknown): FlexibleCtaSectionData {
  const obj = asObject(input);
  return {
    layout: sanitizeFlexibleSectionLayout(obj.layout),
    variant: asString(obj.variant).trim(),
    ctaType: asString(obj.ctaType).trim() || 'general',
    ...sanitizeSectionTextData(input),
    primaryButton:
      !Object.prototype.hasOwnProperty.call(obj, 'primaryButton') || asBoolean(obj.primaryButton),
    secondaryButton: asBoolean(obj.secondaryButton),
    contentBlocks: sanitizeBasicBlocks(obj.contentBlocks),
    supportingKind:
      obj.supportingKind === 'image' || obj.supportingKind === 'video' || obj.supportingKind === 'form'
        ? obj.supportingKind
        : 'none',
    supportingImage: asString(obj.supportingImage).trim(),
    supportingImageAlt: asString(obj.supportingImageAlt).trim(),
    supportingVideoUrl: asString(obj.supportingVideoUrl).trim(),
    supportingFormId: asString(obj.supportingFormId).trim(),
    supportingUnavailableText: asString(obj.supportingUnavailableText).trim(),
  };
}

function sanitizeFlexibleHeroSectionData(input: unknown): FlexibleHeroSectionData {
  const obj = asObject(input);
  return {
    layout: sanitizeFlexibleSectionLayout(obj.layout),
    variant: asString(obj.variant).trim(),
    ...sanitizeSectionTextData(input),
    primaryButton:
      !Object.prototype.hasOwnProperty.call(obj, 'primaryButton') || asBoolean(obj.primaryButton),
    secondaryButton: asBoolean(obj.secondaryButton),
    contentBlocks: sanitizeBasicBlocks(obj.contentBlocks),
    supportingKind:
      obj.supportingKind === 'image' || obj.supportingKind === 'video' || obj.supportingKind === 'form'
        ? obj.supportingKind
        : 'none',
    useContextFeaturedImage: asBoolean(obj.useContextFeaturedImage),
    supportingImage: asString(obj.supportingImage).trim(),
    supportingImageAlt: asString(obj.supportingImageAlt).trim(),
    supportingVideoUrl: asString(obj.supportingVideoUrl).trim(),
    supportingFormId: asString(obj.supportingFormId).trim(),
    supportingUnavailableText: asString(obj.supportingUnavailableText).trim(),
  };
}

function createPrefilledRichTextSectionData(
  heading: string,
  lede: string,
  options?: { variant?: RichTextSectionVariant; image?: string },
): RichTextSectionData {
  return {
    variant: options?.variant ?? 'default',
    accent: '',
    heading,
    lede,
    image: options?.image ?? '',
  };
}

function getDefaultSectionDataForTemplateSlot(
  templateKey: string,
  slotId: string,
  sectionType: string,
  sectionDef: SectionDefinition,
) {
  let data = sectionDef.createDefaultData();

  if (sectionType === 'flexible_hero_section') {
    if (templateKey === 'service-content-v1') {
      data = {
        heading: '{{service}}',
        supportingKind: 'image',
        useContextFeaturedImage: true,
      };
    }
    if (templateKey === 'area-content-v1') {
      data = {
        heading: '{{area}}',
        supportingKind: 'image',
        useContextFeaturedImage: true,
      };
    }
    if (templateKey === 'blog-post-content-v1') {
      data = {
        heading: '{{post}}',
        supportingKind: 'image',
        useContextFeaturedImage: true,
      };
    }
    if (
      templateKey === 'content-page-v1' ||
      templateKey === 'about-page-v1' ||
      templateKey === 'contact-page-v1' ||
      templateKey === 'blog-archive-page-v1' ||
      templateKey === 'areas-archive-page-v1' ||
      templateKey === 'services-archive-page-v1' ||
      templateKey === 'home-page-v1'
    ) {
      data = {
        heading: '{{page}}',
        supportingKind: 'none',
        useContextFeaturedImage: false,
      };
    }
  }

  if (sectionType === 'flexible_cta_section') {
    data = {
      accent: 'contact',
      heading: 'Get a Quote Today',
      lede: '',
      primaryButton: true,
      secondaryButton: false,
      supportingKind: 'none',
    };
  }

  if (sectionType === 'process_section') {
    if (templateKey === 'service-content-v1') {
      data = {
        heading: 'Process',
        lede: '',
        steps: getDefaultProcessSectionSteps('service'),
      };
    }
    if (templateKey === 'area-content-v1') {
      data = {
        heading: 'Process',
        lede: '',
        steps: getDefaultProcessSectionSteps('serviceArea'),
      };
    }
    if (templateKey === 'about-page-v1') {
      data = {
        heading: 'Process',
        lede: '',
        steps: getDefaultProcessSectionSteps('about'),
      };
    }
    if (templateKey === 'home-page-v1') {
      data = {
        heading: 'Process',
        lede: '',
        steps: getDefaultProcessSectionSteps('home'),
      };
    }
  }

  if (sectionType === 'service_grid_section') {
    if (templateKey === 'service-content-v1') data = { heading: 'Other {{parent_service}} Services' };
    if (templateKey === 'area-content-v1') data = { heading: 'Our Services' };
    if (templateKey === 'services-archive-page-v1') data = { heading: 'All Services' };
    if (templateKey === 'home-page-v1') data = { heading: 'Our Services' };
  }
  if (sectionType === 'area_grid_section') {
    if (templateKey === 'area-content-v1') data = { heading: 'Other Service Areas' };
    if (templateKey === 'service-content-v1') data = { heading: 'Our {{service}} Service Area' };
    if (templateKey === 'areas-archive-page-v1') data = { heading: 'Areas We Serve' };
    if (templateKey === 'home-page-v1') data = { heading: 'Areas We Serve' };
  }
  if (sectionType === 'blog_grid_section') {
    if (templateKey === 'blog-post-content-v1' || templateKey === 'service-content-v1') data = { heading: 'Related Blogs' };
    if (templateKey === 'blog-archive-page-v1') data = { heading: 'Our Blog' };
    if (templateKey === 'home-page-v1' || templateKey === 'about-page-v1' || templateKey === 'area-content-v1') {
      data = { heading: 'Latest Blogs' };
    }
  }
  if (sectionType === 'team_grid_section') {
    if (templateKey === 'home-page-v1' || templateKey === 'about-page-v1') data = { heading: 'Our Team' };
  }
  if (sectionType === 'testimonial_section') {
    if (templateKey === 'service-content-v1') data = { heading: 'Our Reviews' };
    if (templateKey === 'area-content-v1') data = { heading: 'Reviews from Our {{area}} Customers' };
    if (templateKey === 'home-page-v1' || templateKey === 'about-page-v1') data = { heading: 'Our Reviews' };
  }
  if (sectionType === 'faq_section') {
    if (templateKey === 'service-content-v1') data = { heading: 'Related {{parent_service}} FAQs' };
    if (templateKey === 'home-page-v1' || templateKey === 'about-page-v1') data = { heading: 'FAQs' };
  }
  if (sectionType === 'projects_section') {
    if (templateKey === 'home-page-v1') data = { heading: 'Recent Projects' };
    if (templateKey === 'service-content-v1') data = { heading: 'Recent {{service}} Projects' };
    if (templateKey === 'area-content-v1') data = { heading: 'Recent Projects in {{area}}' };
  }
  if (sectionType === 'gallery_section') {
    if (templateKey === 'home-page-v1') data = { heading: 'Check Out Our Gallery' };
    if (templateKey === 'service-content-v1') data = { heading: 'Our {{service}} Gallery' };
    if (templateKey === 'area-content-v1') data = { heading: 'Check Out Our Gallery' };
  }
  if (sectionType === 'before_after_section') {
    if (templateKey === 'home-page-v1') data = { heading: 'Before & After' };
    if (templateKey === 'service-content-v1') data = { heading: '{{service}} Before & After' };
    if (templateKey === 'area-content-v1') data = { heading: 'Before & After in {{area}}' };
  }

  if (templateKey === 'home-page-v1' && slotId === 'services' && sectionType === 'service_grid_section') {
    data = { heading: 'All Services' };
  }
  if (templateKey === 'home-page-v1' && slotId === 'areas' && sectionType === 'area_grid_section') {
    data = { heading: 'All Areas' };
  }
  if (templateKey === 'home-page-v1' && slotId === 'team_grid' && sectionType === 'team_grid_section') {
    data = { heading: 'All Team Members' };
  }
  if (templateKey === 'home-page-v1' && slotId === 'latest_articles' && sectionType === 'blog_grid_section') {
    data = { heading: 'Latest Blogs' };
  }
  if (templateKey === 'about-page-v1' && slotId === 'latest_articles' && sectionType === 'blog_grid_section') {
    data = { heading: 'Latest Blogs' };
  }
  if (templateKey === 'service-content-v1' && slotId === 'other_services' && sectionType === 'service_grid_section') {
    data = { heading: 'Other {{parent_service}} Services' };
  }
  if (templateKey === 'service-content-v1' && slotId === 'related_areas' && sectionType === 'area_grid_section') {
    data = { heading: 'Our {{service}} Service Area' };
  }
  if (templateKey === 'service-content-v1' && slotId === 'related_articles' && sectionType === 'blog_grid_section') {
    data = { heading: 'Related Blogs' };
  }
  if (templateKey === 'area-content-v1' && slotId === 'services' && sectionType === 'service_grid_section') {
    data = { heading: 'All Services' };
  }
  if (templateKey === 'area-content-v1' && slotId === 'other_areas' && sectionType === 'area_grid_section') {
    data = { heading: 'Other Service Areas' };
  }
  if (templateKey === 'area-content-v1' && slotId === 'latest_articles' && sectionType === 'blog_grid_section') {
    data = { heading: 'Latest Blogs' };
  }
  if (templateKey === 'blog-archive-page-v1' && slotId === 'blog_grid' && sectionType === 'blog_grid_section') {
    data = { heading: 'Our Blog' };
  }
  if (templateKey === 'services-archive-page-v1' && slotId === 'service_grid' && sectionType === 'service_grid_section') {
    data = { heading: 'All Services' };
  }
  if (templateKey === 'areas-archive-page-v1' && slotId === 'service_areas_grid' && sectionType === 'area_grid_section') {
    data = { heading: 'All Areas' };
  }
  if (templateKey === 'blog-post-content-v1' && slotId === 'related_articles' && sectionType === 'blog_grid_section') {
    data = { heading: 'Related Blogs' };
  }
  if (templateKey === 'home-page-v1' && slotId === 'testimonials' && sectionType === 'testimonial_section') {
    data = { heading: 'Our Reviews' };
  }
  if (templateKey === 'home-page-v1' && slotId === 'faq' && sectionType === 'faq_section') {
    data = { heading: 'FAQs' };
  }
  if (templateKey === 'service-content-v1' && slotId === 'related_reviews' && sectionType === 'testimonial_section') {
    data = { heading: '{{parent_service}} Reviews' };
  }
  if (templateKey === 'service-content-v1' && slotId === 'related_faqs' && sectionType === 'faq_section') {
    data = { heading: 'Related {{parent_service}} FAQs' };
  }
  if (templateKey === 'area-content-v1' && slotId === 'testimonials' && sectionType === 'testimonial_section') {
    data = { heading: 'Reviews from Our {{area}} Customers' };
  }
  if (templateKey === 'home-page-v1' && slotId === 'latest_projects' && sectionType === 'projects_section') {
    data = { heading: 'Recent Projects' };
  }
  if (templateKey === 'home-page-v1' && slotId === 'primary_gallery' && sectionType === 'gallery_section') {
    data = { heading: 'Check Out Our Gallery' };
  }
  if (templateKey === 'home-page-v1' && slotId === 'latest_before_after' && sectionType === 'before_after_section') {
    data = { heading: 'Before & After' };
  }
  if (templateKey === 'service-content-v1' && slotId === 'related_projects' && sectionType === 'projects_section') {
    data = { heading: 'Recent {{service}} Projects' };
  }
  if (templateKey === 'service-content-v1' && slotId === 'service_gallery' && sectionType === 'gallery_section') {
    data = { heading: 'Our {{service}} Gallery' };
  }
  if (templateKey === 'service-content-v1' && slotId === 'gallery' && sectionType === 'gallery_section') {
    data = { heading: 'Our {{service}} Gallery' };
  }
  if (templateKey === 'service-content-v1' && slotId === 'before_after' && sectionType === 'before_after_section') {
    data = { heading: '{{service}} Before & After' };
  }
  if (templateKey === 'area-content-v1' && slotId === 'gallery' && sectionType === 'gallery_section') {
    data = { heading: 'Check Out Our Gallery' };
  }
  if (templateKey === 'area-content-v1' && slotId === 'before_after' && sectionType === 'before_after_section') {
    data = { heading: 'Before & After in {{area}}' };
  }

  return data;
}

function normalizeSectionTextMeta(input: Record<string, unknown>) {
  const accent = asString(input.accent).trim();
  const heading = asString(input.heading).trim();
  const lede = asString(input.lede).trim();

  return {
    ...input,
    accent,
    heading,
    lede,
  };
}

export const sectionRegistry: Record<string, SectionDefinition> = {
  layout_marker: {
    type: 'layout_marker',
    label: 'Layout Marker',
    fields: [],
    createDefaultData: () => ({}),
    sanitizeData: () => ({}),
  },
  hero_standard: {
    type: 'hero_standard',
    label: 'Content Hero',
    fields: [
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text', required: false, placeholder: 'Main heading' },
      { key: 'lede', label: 'Lede', kind: 'textarea', placeholder: 'Supporting copy' },
    ],
    createDefaultData: (): HeroStandardData => ({
      accent: '',
      heading: '',
      lede: '',
      primaryCta: { text: '', href: '' },
    }),
    sanitizeData: (input: unknown): HeroStandardData => {
      const obj = asObject(input);
      const cta = asObject(obj.primaryCta);
      return {
        accent: asString(obj.accent).trim(),
        heading: asString(obj.heading).trim(),
        lede: asString(obj.lede).trim(),
        primaryCta: {
          text: asString(cta.text).trim(),
          href: asString(cta.href).trim(),
        },
      };
    },
    importAliases: {
      hero_cta_text: 'primaryCta.text',
      hero_cta_href: 'primaryCta.href',
    },
  },
  rich_text_section: {
    type: 'rich_text_section',
    label: 'Content',
    fields: [
      {
        key: 'variant',
        label: 'Layout',
        kind: 'select',
        options: [
          { value: 'default', label: 'Default' },
          { value: 'split', label: 'Split' },
          { value: 'feature', label: 'Feature' },
        ],
      },
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
      { key: 'image', label: 'Image', kind: 'image' },
    ],
    createDefaultData: (): RichTextSectionData => ({
      variant: 'default',
      accent: '',
      heading: '',
      lede: '',
      image: '',
    }),
    sanitizeData: sanitizeRichTextSectionData,
    importAliases: {},
  },
  content_2_column_section: {
    type: 'content_2_column_section',
    label: 'Content - 2 Column',
    fields: [
      {
        key: 'variant',
        label: 'Media Position',
        kind: 'select',
        options: [
          { value: 'media_left', label: 'Media Left' },
          { value: 'media_right', label: 'Media Right' },
        ],
      },
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
      { key: 'image', label: 'Image', kind: 'image' },
    ],
    createDefaultData: (): TwoColumnContentSectionData => ({
      variant: 'media_right',
      accent: '',
      heading: '',
      lede: '',
      image: '',
    }),
    sanitizeData: sanitizeTwoColumnContentSectionData,
    importAliases: {},
  },
  flexible_section: {
    type: 'flexible_section',
    label: 'Flexible Section',
    fields: [
      {
        key: 'layout',
        label: 'Layout',
        kind: 'select',
        options: [
          { value: 'one_column', label: '1 Column' },
          { value: 'two_column_text_left', label: '2 Column - Text Left' },
          { value: 'two_column_text_right', label: '2 Column - Text Right' },
        ],
      },
      {
        key: 'variant',
        label: 'Variant',
        kind: 'select',
        options: [
          { value: 'default', label: 'Default' },
          { value: 'boxed', label: 'Boxed' },
          { value: 'minimal', label: 'Minimal' },
          { value: 'split_panel', label: 'Split Panel' },
          { value: 'contrast', label: 'Contrast' },
        ],
      },
      {
        key: 'ctaType',
        label: 'CTA Type',
        kind: 'select',
        options: [
          { value: 'general', label: 'General' },
          { value: 'contact', label: 'Contact' },
          { value: 'quote', label: 'Quote' },
          { value: 'service', label: 'Service' },
          { value: 'promotion', label: 'Promotion' },
        ],
      },
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
      { key: 'primaryButton', label: 'Primary Btn', kind: 'boolean' },
      { key: 'secondaryButton', label: 'Secondary Btn', kind: 'boolean' },
      { key: 'contentBlocks', label: 'Content Blocks', kind: 'blocks' },
      { key: 'useContextFeaturedImage', label: 'Use Featured Image', kind: 'boolean' },
      {
        key: 'supportingKind',
        label: 'Supporting Content',
        kind: 'select',
        options: [
          { value: 'none', label: 'None' },
          { value: 'blocks', label: 'Blocks' },
          { value: 'image', label: 'Image' },
          { value: 'form', label: 'Form' },
          { value: 'logos', label: 'Logos' },
        ],
      },
      { key: 'supportingBlocks', label: 'Blocks', kind: 'blocks' },
      { key: 'supportingImage', label: 'Image', kind: 'image' },
      { key: 'supportingVideoUrl', label: 'Video URL', kind: 'url' },
      { key: 'supportingFormId', label: 'Form', kind: 'select', optionsKey: 'contact_form_id' },
      { key: 'supportingUnavailableText', label: 'Form Fallback', kind: 'textarea' },
      {
        key: 'logos',
        label: 'Logos',
        kind: 'list',
        itemLabel: 'Logo',
        itemSchema: {
          key: 'logo',
          label: 'Logo',
          kind: 'group',
          fields: [
            { key: 'image', label: 'Image', kind: 'image' },
            { key: 'alt', label: 'Alt Text', kind: 'text' },
            { key: 'label', label: 'Label', kind: 'text' },
            { key: 'href', label: 'Link', kind: 'url' },
          ],
        },
      },
    ],
    createDefaultData: (): FlexibleSectionData => ({
      layout: 'two_column_text_left',
      variant: 'default',
      accent: '',
      heading: '',
      lede: '',
      primaryButton: false,
      secondaryButton: false,
      contentBlocks: [],
      supportingKind: 'none',
      useContextFeaturedImage: false,
      supportingBlocks: [],
      supportingImage: '',
      supportingImageAlt: '',
      supportingVideoUrl: '',
      supportingFormId: '',
      supportingUnavailableText: '',
      logos: [],
    }),
    sanitizeData: sanitizeFlexibleSectionData,
    importAliases: {},
  },
  flexible_form_section: {
    type: 'flexible_form_section',
    label: 'Flexible Form Section',
    fields: [
      {
        key: 'layout',
        label: 'Layout',
        kind: 'select',
        options: [
          { value: 'one_column', label: '1 Column' },
          { value: 'two_column_text_left', label: '2 Column - Text Left' },
          { value: 'two_column_text_right', label: '2 Column - Text Right' },
        ],
      },
      {
        key: 'variant',
        label: 'Variant',
        kind: 'select',
        options: [
          { value: 'default', label: 'Default' },
          { value: 'boxed', label: 'Boxed' },
          { value: 'minimal', label: 'Minimal' },
          { value: 'split_panel', label: 'Split Panel' },
          { value: 'contrast', label: 'Contrast' },
        ],
      },
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
      { key: 'primaryButton', label: 'Primary Btn', kind: 'boolean' },
      { key: 'secondaryButton', label: 'Secondary Btn', kind: 'boolean' },
      { key: 'contentBlocks', label: 'Content Blocks', kind: 'blocks' },
      { key: 'contact_form_id', label: 'Form', kind: 'select', optionsKey: 'contact_form_id' },
      { key: 'unavailableText', label: 'Form Fallback', kind: 'textarea' },
      { key: 'supportingImage', label: 'Image', kind: 'image' },
    ],
    createDefaultData: (): FlexibleFormSectionData => ({
      layout: 'two_column_text_left',
      variant: 'default',
      accent: '',
      heading: '',
      lede: '',
      primaryButton: false,
      secondaryButton: false,
      contentBlocks: [],
      contact_form_id: '',
      unavailableText: 'Form is unavailable right now.',
      supportingImage: '',
      supportingImageAlt: '',
    }),
    sanitizeData: sanitizeFlexibleFormSectionData,
    importAliases: {},
  },
  list_section: {
    type: 'list_section',
    label: 'List',
    fields: [
      {
        key: 'variant',
        label: 'Style',
        kind: 'select',
        options: [
          { value: 'unordered', label: 'Bulleted' },
          { value: 'ordered', label: 'Numbered' },
        ],
      },
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
      {
        key: 'items',
        label: 'Items',
        kind: 'list',
        itemLabel: 'Item',
        itemSchema: {
          key: 'item',
          label: 'Item',
          kind: 'group',
          fields: [
            { key: 'title', label: 'Title', kind: 'text' },
            { key: 'body', label: 'Body', kind: 'textarea' },
          ],
        },
      },
    ],
    createDefaultData: (): ListSectionData => ({
      variant: 'unordered',
      accent: '',
      heading: '',
      lede: '',
      items: [
        { title: 'First item', body: '' },
        { title: 'Second item', body: '' },
        { title: 'Third item', body: '' },
      ],
    }),
    sanitizeData: sanitizeListSectionData,
    importAliases: {},
  },
  table_section: {
    type: 'table_section',
    label: 'Table',
    fields: [
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
      {
        key: 'columns',
        label: 'Columns',
        kind: 'list',
        itemLabel: 'Column',
        itemSchema: {
          key: 'column',
          label: 'Column',
          kind: 'text',
          placeholder: 'Column heading',
        },
      },
      {
        key: 'rows',
        label: 'Rows',
        kind: 'list',
        itemLabel: 'Row',
        itemSchema: {
          key: 'row',
          label: 'Row',
          kind: 'group',
          fields: [
            {
              key: 'cells',
              label: 'Cells',
              kind: 'list',
              itemLabel: 'Cell',
              itemSchema: {
                key: 'cell',
                label: 'Cell',
                kind: 'text',
                placeholder: 'Cell value',
              },
            },
          ],
        },
      },
    ],
    createDefaultData: (): TableSectionData => ({
      accent: '',
      heading: '',
      lede: '',
      columns: ['Column 1', 'Column 2', 'Column 3'],
      rows: [
        { cells: ['Value 1', 'Value 2', 'Value 3'] },
        { cells: ['Value 4', 'Value 5', 'Value 6'] },
      ],
    }),
    sanitizeData: sanitizeTableSectionData,
    importAliases: {},
  },
  process_section: {
    type: 'process_section',
    label: 'Process',
    fields: [
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
      {
        key: 'steps',
        label: 'Steps',
        kind: 'list',
        itemLabel: 'Step',
        itemSchema: {
          key: 'step',
          label: 'Step',
          kind: 'group',
          fields: [
            { key: 'heading', label: 'Heading', kind: 'text' },
            { key: 'lede', label: 'Lede', kind: 'textarea' },
          ],
        },
        minItems: 1,
      },
    ],
    createDefaultData: (): ProcessSectionData => ({
      accent: '',
      heading: 'Process',
      lede: '',
      steps: getDefaultProcessSectionSteps('home'),
    }),
    sanitizeData: (input: unknown): ProcessSectionData => sanitizeProcessSectionData(input, 'home'),
    importAliases: {},
  },
  long_form_body_section: {
    type: 'long_form_body_section',
    label: 'Body Content',
    fields: [
      { key: 'blocks', label: 'Body Content', kind: 'blocks', required: true },
    ],
    createDefaultData: (): LongFormBodySectionData => createEmptyLongFormBodySectionData(),
    sanitizeData: (input: unknown): LongFormBodySectionData => {
      const obj = asObject(input);
      if (Array.isArray(obj.blocks)) {
        return { blocks: sanitizeBasicBlocks(obj.blocks) };
      }
      return { blocks: [] };
    },
    importAliases: {},
  },
  cta_band: {
    type: 'cta_band',
    label: 'CTA Section',
    fields: [
      {
        key: 'layout',
        label: 'Layout',
        kind: 'select',
        options: [
          { value: 'default', label: 'Default' },
          { value: 'split', label: 'Split' },
          { value: 'feature', label: 'Feature' },
        ],
      },
      {
        key: 'variant',
        label: 'Variant',
        kind: 'select',
        options: [
          { value: 'default', label: 'Default' },
          { value: 'boxed', label: 'Boxed' },
          { value: 'minimal', label: 'Minimal' },
          { value: 'contrast', label: 'Contrast' },
        ],
      },
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
    ],
    createDefaultData: (): CtaBandData => ({
      layout: 'default',
      variant: 'default',
      accent: 'contact',
      heading: 'Get a Quote Today',
      lede: '',
    }),
    sanitizeData: sanitizeCtaBandData,
    importAliases: {
      cta_heading: 'heading',
    },
  },
  flexible_cta_section: {
    type: 'flexible_cta_section',
    label: 'CTA',
    fields: [
      {
        key: 'layout',
        label: 'Layout',
        kind: 'select',
        options: [
          { value: 'one_column', label: '1 Column' },
          { value: 'two_column_text_left', label: '2 Column - Text Left' },
          { value: 'two_column_text_right', label: '2 Column - Text Right' },
        ],
      },
      {
        key: 'variant',
        label: 'Variant',
        kind: 'select',
        options: [
          { value: 'default', label: 'Default' },
          { value: 'boxed', label: 'Boxed' },
          { value: 'minimal', label: 'Minimal' },
          { value: 'split_panel', label: 'Split Panel' },
          { value: 'contrast', label: 'Contrast' },
        ],
      },
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
      { key: 'primaryButton', label: 'Primary Btn', kind: 'boolean' },
      { key: 'secondaryButton', label: 'Secondary Btn', kind: 'boolean' },
      { key: 'contentBlocks', label: 'Content Blocks', kind: 'blocks' },
      { key: 'useContextFeaturedImage', label: 'Use Featured Image', kind: 'boolean' },
      { key: 'supportingImage', label: 'Image', kind: 'image' },
      { key: 'supportingVideoUrl', label: 'Video URL', kind: 'url' },
      { key: 'supportingFormId', label: 'Form', kind: 'select', optionsKey: 'contact_form_id' },
      { key: 'supportingUnavailableText', label: 'Form Fallback', kind: 'textarea' },
    ],
    createDefaultData: (): FlexibleCtaSectionData => ({
      layout: 'two_column_text_left',
      variant: 'default',
      ctaType: 'general',
      accent: 'contact',
      heading: 'Get a Quote Today',
      lede: '',
      primaryButton: true,
      secondaryButton: false,
      contentBlocks: [],
      supportingKind: 'none',
      supportingImage: '',
      supportingImageAlt: '',
      supportingVideoUrl: '',
      supportingFormId: '',
      supportingUnavailableText: '',
    }),
    sanitizeData: sanitizeFlexibleCtaSectionData,
    importAliases: {},
  },
  flexible_hero_section: {
    type: 'flexible_hero_section',
    label: 'Hero',
    fields: [
      {
        key: 'layout',
        label: 'Layout',
        kind: 'select',
        options: [
          { value: 'one_column', label: '1 Column' },
          { value: 'two_column_text_left', label: '2 Column - Text Left' },
          { value: 'two_column_text_right', label: '2 Column - Text Right' },
        ],
      },
      {
        key: 'variant',
        label: 'Variant',
        kind: 'select',
        options: [
          { value: 'default', label: 'Default' },
          { value: 'boxed', label: 'Boxed' },
          { value: 'minimal', label: 'Minimal' },
          { value: 'split_panel', label: 'Split Panel' },
          { value: 'contrast', label: 'Contrast' },
        ],
      },
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
      { key: 'primaryButton', label: 'Primary Btn', kind: 'boolean' },
      { key: 'secondaryButton', label: 'Secondary Btn', kind: 'boolean' },
      { key: 'contentBlocks', label: 'Content Blocks', kind: 'blocks' },
      { key: 'useContextFeaturedImage', label: 'Use Featured Image', kind: 'boolean' },
      { key: 'supportingImage', label: 'Image', kind: 'image' },
      { key: 'supportingVideoUrl', label: 'Video URL', kind: 'url' },
      { key: 'supportingFormId', label: 'Form', kind: 'select', optionsKey: 'contact_form_id' },
      { key: 'supportingUnavailableText', label: 'Form Fallback', kind: 'textarea' },
    ],
    createDefaultData: (): FlexibleHeroSectionData => ({
      layout: 'two_column_text_left',
      variant: 'default',
      accent: '',
      heading: '{{page}}',
      lede: '',
      primaryButton: true,
      secondaryButton: false,
      contentBlocks: [],
      supportingKind: 'none',
      useContextFeaturedImage: false,
      supportingImage: '',
      supportingImageAlt: '',
      supportingVideoUrl: '',
      supportingFormId: '',
      supportingUnavailableText: '',
    }),
    sanitizeData: sanitizeFlexibleHeroSectionData,
    importAliases: {},
  },
  service_archive_hero_section: {
    type: 'service_archive_hero_section',
    label: 'Service Archive Hero',
    fields: [
      {
        key: 'layout',
        label: 'Layout',
        kind: 'select',
        options: [
          { value: 'default', label: 'Default' },
          { value: 'split', label: 'Split' },
          { value: 'feature', label: 'Feature' },
        ],
      },
      {
        key: 'variant',
        label: 'Variant',
        kind: 'select',
        options: [
          { value: 'default', label: 'Default' },
          { value: 'boxed', label: 'Boxed' },
          { value: 'minimal', label: 'Minimal' },
          { value: 'contrast', label: 'Contrast' },
        ],
      },
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
    ],
    createDefaultData: (): PageHeroData => ({ layout: 'default', variant: 'default', accent: '', heading: '{{page}}', lede: '' }),
    sanitizeData: (input: unknown): PageHeroData => {
      return sanitizePageHeroData(input, '{{page}}');
    },
  },
  service_area_archive_hero_section: {
    type: 'service_area_archive_hero_section',
    label: 'Area Archive Hero',
    fields: [
      {
        key: 'layout',
        label: 'Layout',
        kind: 'select',
        options: [
          { value: 'default', label: 'Default' },
          { value: 'split', label: 'Split' },
          { value: 'feature', label: 'Feature' },
        ],
      },
      {
        key: 'variant',
        label: 'Variant',
        kind: 'select',
        options: [
          { value: 'default', label: 'Default' },
          { value: 'boxed', label: 'Boxed' },
          { value: 'minimal', label: 'Minimal' },
          { value: 'contrast', label: 'Contrast' },
        ],
      },
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
    ],
    createDefaultData: (): PageHeroData => ({ layout: 'default', variant: 'default', accent: '', heading: '{{page}}', lede: '' }),
    sanitizeData: (input: unknown): PageHeroData => {
      return sanitizePageHeroData(input, '{{page}}');
    },
  },
  blog_archive_hero_section: {
    type: 'blog_archive_hero_section',
    label: 'Blog Archive Hero',
    fields: [
      {
        key: 'layout',
        label: 'Layout',
        kind: 'select',
        options: [
          { value: 'default', label: 'Default' },
          { value: 'split', label: 'Split' },
          { value: 'feature', label: 'Feature' },
        ],
      },
      {
        key: 'variant',
        label: 'Variant',
        kind: 'select',
        options: [
          { value: 'default', label: 'Default' },
          { value: 'boxed', label: 'Boxed' },
          { value: 'minimal', label: 'Minimal' },
          { value: 'contrast', label: 'Contrast' },
        ],
      },
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
    ],
    createDefaultData: (): PageHeroData => ({ layout: 'default', variant: 'default', accent: '', heading: '{{page}}', lede: '' }),
    sanitizeData: (input: unknown): PageHeroData => {
      return sanitizePageHeroData(input, '{{page}}');
    },
  },
  contact_hero_section: {
    type: 'contact_hero_section',
    label: 'Contact Hero',
    fields: [
      {
        key: 'layout',
        label: 'Layout',
        kind: 'select',
        options: [
          { value: 'default', label: 'Default' },
          { value: 'split', label: 'Split' },
          { value: 'feature', label: 'Feature' },
        ],
      },
      {
        key: 'variant',
        label: 'Variant',
        kind: 'select',
        options: [
          { value: 'default', label: 'Default' },
          { value: 'boxed', label: 'Boxed' },
          { value: 'minimal', label: 'Minimal' },
          { value: 'contrast', label: 'Contrast' },
        ],
      },
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
    ],
    createDefaultData: (): PageHeroData => ({ layout: 'default', variant: 'default', accent: '', heading: '{{page}}', lede: '' }),
    sanitizeData: (input: unknown): PageHeroData => {
      return sanitizePageHeroData(input, '{{page}}');
    },
  },
  home_hero_section: {
    type: 'home_hero_section',
    label: 'Home Hero',
    fields: [
      {
        key: 'layout',
        label: 'Layout',
        kind: 'select',
        options: [
          { value: 'default', label: 'Default' },
          { value: 'split', label: 'Split' },
          { value: 'feature', label: 'Feature' },
        ],
      },
      {
        key: 'variant',
        label: 'Variant',
        kind: 'select',
        options: [
          { value: 'default', label: 'Default' },
          { value: 'boxed', label: 'Boxed' },
          { value: 'minimal', label: 'Minimal' },
          { value: 'contrast', label: 'Contrast' },
        ],
      },
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
    ],
    createDefaultData: (): HomeHeroSectionData => ({
      layout: 'default',
      variant: 'default',
      accent: 'Locally Trusted Home Services',
      heading: '{{business}}',
      lede: '',
      primaryCtaText: 'Get a Free Quote',
      primaryCtaHref: '/contact',
      secondaryCtaText: 'Our Services',
      secondaryCtaHref: '/services',
    }),
    sanitizeData: sanitizeHomeHeroData,
  },
  service_grid_section: {
    type: 'service_grid_section',
    label: 'Service Grid',
    fields: [
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
    ],
    createDefaultData: (): SectionTextData => ({ accent: '', heading: 'Service', lede: '' }),
    sanitizeData: sanitizeSectionTextData,
  },
  testimonial_section: {
    type: 'testimonial_section',
    label: 'Testimonials',
    fields: [
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
    ],
    createDefaultData: (): SectionTextData => ({ accent: '', heading: 'Our Reviews', lede: '' }),
    sanitizeData: sanitizeSectionTextData,
  },
  faq_section: {
    type: 'faq_section',
    label: 'FAQ Section',
    fields: [
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
    ],
    createDefaultData: (): SectionTextData => ({ accent: '', heading: 'FAQs', lede: '' }),
    sanitizeData: sanitizeSectionTextData,
  },
  projects_section: {
    type: 'projects_section',
    label: 'Projects',
    fields: [
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
    ],
    createDefaultData: (): SectionTextData => ({ accent: '', heading: 'Recent Projects', lede: '' }),
    sanitizeData: sanitizeSectionTextData,
    importAliases: {
      featured_projects_section: 'projects_section',
      service_projects_section: 'projects_section',
      area_projects_section: 'projects_section',
    },
  },
  profile_card_featured_section: {
    type: 'profile_card_featured_section',
    label: 'Owner Spotlight',
    fields: [
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
      { key: 'profileAccent', label: 'Profile Accent', kind: 'text' },
      { key: 'profileBody', label: 'Profile Body Fallback', kind: 'textarea' },
    ],
    createDefaultData: (): OwnerSpotlightSectionData => ({
      heading: "Who You'll Work With",
      lede: 'A local crew focused on clean installs, clear communication, and dependable follow-through.',
      profileAccent: 'Profile',
      profileBody: 'We focus on reliable scheduling, clean job sites, and landscaping work that improves curb appeal season after season.',
    }),
    sanitizeData: (input: unknown): OwnerSpotlightSectionData => {
      const obj = asObject(input);
      return {
        heading: asString(obj.heading).trim(),
        lede: asString(obj.lede).trim(),
        profileAccent: asString(obj.profileAccent).trim(),
        profileBody: asString(obj.profileBody).trim(),
      };
    },
  },
  callout_quote_featured_section: {
    type: 'callout_quote_featured_section',
    label: 'Callout Quote',
    fields: [
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
      { key: 'quote', label: 'Quote', kind: 'textarea' },
      { key: 'attribution', label: 'Attribution', kind: 'text' },
    ],
    createDefaultData: (): QuoteSectionData => ({ accent: '', heading: 'What People Notice', lede: '', quote: '', attribution: '' }),
    sanitizeData: (input: unknown): QuoteSectionData => {
      const obj = asObject(input);
      return {
        ...sanitizeSectionTextData(input),
        quote: asString(obj.quote).trim(),
        attribution: asString(obj.attribution).trim(),
      };
    },
  },
  area_grid_section: {
    type: 'area_grid_section',
    label: 'Area Grid',
    fields: [
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
    ],
    createDefaultData: (): SectionTextData => ({ accent: '', heading: 'Area', lede: '' }),
    sanitizeData: sanitizeSectionTextData,
  },
  blog_grid_section: {
    type: 'blog_grid_section',
    label: 'Blog Grid',
    fields: [
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
    ],
    createDefaultData: (): SectionTextData => ({ accent: '', heading: 'Blog', lede: '' }),
    sanitizeData: sanitizeSectionTextData,
  },
  team_grid_section: {
    type: 'team_grid_section',
    label: 'Team Grid',
    fields: [
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
    ],
    createDefaultData: (): SectionTextData => ({ accent: '', heading: 'Team', lede: '' }),
    sanitizeData: sanitizeSectionTextData,
  },
  contact_form_section: {
    type: 'contact_form_section',
    label: 'Form Section',
    fields: [
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
      { key: 'contact_form_id', label: 'Form', kind: 'select', optionsKey: 'contact_form_id' },
      { key: 'unavailableText', label: 'Unavailable Message', kind: 'text' },
    ],
    createDefaultData: (): FormSectionData => ({
      accent: '',
      heading: '',
      lede: '',
      contact_form_id: '',
      unavailableText: 'Form is unavailable right now.',
    }),
    sanitizeData: (input: unknown): FormSectionData => {
      const obj = asObject(input);
      return {
        ...sanitizeSectionTextData(input),
        contact_form_id: asString(obj.contact_form_id).trim(),
        unavailableText: asString(obj.unavailableText).trim(),
      };
    },
  },
    process_home_section: {
      type: 'process_home_section',
      label: 'Process (Home)',
      fields: [
        { key: 'accent', label: 'Accent', kind: 'text' },
        { key: 'heading', label: 'Heading', kind: 'text' },
        { key: 'lede', label: 'Lede', kind: 'textarea' },
        {
          key: 'steps',
          label: 'Steps',
          kind: 'list',
          itemLabel: 'Step',
          itemSchema: {
            key: 'step',
            label: 'Step',
            kind: 'group',
            fields: [
              { key: 'heading', label: 'Heading', kind: 'text' },
              { key: 'lede', label: 'Lede', kind: 'textarea' },
            ],
          },
          minItems: 1,
        },
      ],
      createDefaultData: (): ProcessSectionData => ({
        accent: '',
        heading: 'Process',
        lede: '',
        steps: getDefaultProcessSectionSteps('home'),
      }),
      sanitizeData: (input: unknown): ProcessSectionData => sanitizeProcessSectionData(input, 'home'),
    },
    process_service_section: {
      type: 'process_service_section',
      label: 'Process (Service)',
      fields: [
        { key: 'accent', label: 'Accent', kind: 'text' },
        { key: 'heading', label: 'Heading', kind: 'text' },
        { key: 'lede', label: 'Lede', kind: 'textarea' },
        {
          key: 'steps',
          label: 'Steps',
          kind: 'list',
          itemLabel: 'Step',
          itemSchema: {
            key: 'step',
            label: 'Step',
            kind: 'group',
            fields: [
              { key: 'heading', label: 'Heading', kind: 'text' },
              { key: 'lede', label: 'Lede', kind: 'textarea' },
            ],
          },
          minItems: 1,
        },
      ],
      createDefaultData: (): ProcessSectionData => ({
        accent: '',
        heading: 'Process',
        lede: '',
        steps: getDefaultProcessSectionSteps('service'),
      }),
      sanitizeData: (input: unknown): ProcessSectionData => sanitizeProcessSectionData(input, 'service'),
    },
    process_service_area_section: {
      type: 'process_service_area_section',
      label: 'Process (Area)',
      fields: [
        { key: 'accent', label: 'Accent', kind: 'text' },
        { key: 'heading', label: 'Heading', kind: 'text' },
        { key: 'lede', label: 'Lede', kind: 'textarea' },
        {
          key: 'steps',
          label: 'Steps',
          kind: 'list',
          itemLabel: 'Step',
          itemSchema: {
            key: 'step',
            label: 'Step',
            kind: 'group',
            fields: [
              { key: 'heading', label: 'Heading', kind: 'text' },
              { key: 'lede', label: 'Lede', kind: 'textarea' },
            ],
          },
          minItems: 1,
        },
      ],
      createDefaultData: (): ProcessSectionData => ({
        accent: '',
        heading: 'Process',
        lede: '',
        steps: getDefaultProcessSectionSteps('serviceArea'),
      }),
      sanitizeData: (input: unknown): ProcessSectionData => sanitizeProcessSectionData(input, 'serviceArea'),
    },
    process_about_section: {
      type: 'process_about_section',
      label: 'Process (About)',
      fields: [
        { key: 'accent', label: 'Accent', kind: 'text' },
        { key: 'heading', label: 'Heading', kind: 'text' },
        { key: 'lede', label: 'Lede', kind: 'textarea' },
        {
          key: 'steps',
          label: 'Steps',
          kind: 'list',
          itemLabel: 'Step',
          itemSchema: {
            key: 'step',
            label: 'Step',
            kind: 'group',
            fields: [
              { key: 'heading', label: 'Heading', kind: 'text' },
              { key: 'lede', label: 'Lede', kind: 'textarea' },
            ],
          },
          minItems: 1,
        },
      ],
      createDefaultData: (): ProcessSectionData => ({
        accent: '',
        heading: 'Process',
        lede: '',
        steps: getDefaultProcessSectionSteps('about'),
      }),
      sanitizeData: (input: unknown): ProcessSectionData => sanitizeProcessSectionData(input, 'about'),
    },
  about_hero_section: {
    type: 'about_hero_section',
    label: 'About Hero',
    fields: [
      {
        key: 'layout',
        label: 'Layout',
        kind: 'select',
        options: [
          { value: 'default', label: 'Default' },
          { value: 'split', label: 'Split' },
          { value: 'feature', label: 'Feature' },
        ],
      },
      {
        key: 'variant',
        label: 'Variant',
        kind: 'select',
        options: [
          { value: 'default', label: 'Default' },
          { value: 'boxed', label: 'Boxed' },
          { value: 'minimal', label: 'Minimal' },
          { value: 'contrast', label: 'Contrast' },
        ],
      },
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
    ],
    createDefaultData: (): DetailHeroTextData => ({ layout: 'default', variant: 'default', accent: '', heading: '{{page}}', lede: '' }),
    sanitizeData: sanitizeDetailHeroTextData,
  },
  service_hero_section: {
    type: 'service_hero_section',
    label: 'Service Hero',
    fields: [
      {
        key: 'layout',
        label: 'Layout',
        kind: 'select',
        options: [
          { value: 'default', label: 'Default' },
          { value: 'split', label: 'Split' },
          { value: 'feature', label: 'Feature' },
        ],
      },
      {
        key: 'variant',
        label: 'Variant',
        kind: 'select',
        options: [
          { value: 'default', label: 'Default' },
          { value: 'boxed', label: 'Boxed' },
          { value: 'minimal', label: 'Minimal' },
          { value: 'contrast', label: 'Contrast' },
        ],
      },
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
    ],
    createDefaultData: (): ServiceHeroData => ({ layout: 'default', variant: 'default', accent: '', heading: '', lede: '' }),
    sanitizeData: sanitizeServiceHeroData,
  },
  service_area_hero_section: {
    type: 'service_area_hero_section',
    label: 'Area Hero',
    fields: [
      {
        key: 'layout',
        label: 'Layout',
        kind: 'select',
        options: [
          { value: 'default', label: 'Default' },
          { value: 'split', label: 'Split' },
          { value: 'feature', label: 'Feature' },
        ],
      },
      {
        key: 'variant',
        label: 'Variant',
        kind: 'select',
        options: [
          { value: 'default', label: 'Default' },
          { value: 'boxed', label: 'Boxed' },
          { value: 'minimal', label: 'Minimal' },
          { value: 'contrast', label: 'Contrast' },
        ],
      },
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
    ],
    createDefaultData: (): AreaHeroData => ({ layout: 'default', variant: 'default', accent: '', heading: '', lede: '' }),
    sanitizeData: sanitizeAreaHeroData,
  },
  blog_hero_section: {
    type: 'blog_hero_section',
    label: 'Blog Page Hero',
    fields: [
      {
        key: 'layout',
        label: 'Layout',
        kind: 'select',
        options: [
          { value: 'default', label: 'Default' },
          { value: 'split', label: 'Split' },
          { value: 'feature', label: 'Feature' },
        ],
      },
      {
        key: 'variant',
        label: 'Variant',
        kind: 'select',
        options: [
          { value: 'default', label: 'Default' },
          { value: 'boxed', label: 'Boxed' },
          { value: 'minimal', label: 'Minimal' },
          { value: 'contrast', label: 'Contrast' },
        ],
      },
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
    ],
    createDefaultData: (): DetailHeroTextData => ({ layout: 'default', variant: 'default', accent: '', heading: '', lede: '' }),
    sanitizeData: sanitizeDetailHeroTextData,
  },
  gallery_section: {
    type: 'gallery_section',
    label: 'Gallery',
    fields: [
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
    ],
    createDefaultData: (): SectionTextData => ({ accent: '', heading: 'Check Out Our Gallery', lede: '' }),
    sanitizeData: sanitizeSectionTextData,
    importAliases: {
      service_gallery_section: 'gallery_section',
      related_gallery_section: 'gallery_section',
    },
  },
  logos_section: {
    type: 'logos_section',
    label: 'Logos',
    fields: [
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
      {
        key: 'logos',
        label: 'Logos',
        kind: 'list',
        itemLabel: 'Logo',
        itemSchema: {
          key: 'logo',
          label: 'Logo',
          kind: 'group',
          fields: [
            { key: 'image', label: 'Image', kind: 'image', required: true },
            { key: 'alt', label: 'Alt Text', kind: 'text' },
            { key: 'label', label: 'Label', kind: 'text' },
            { key: 'href', label: 'Link URL', kind: 'url' },
          ],
        },
      },
    ],
    createDefaultData: (): LogosSectionData => ({
      accent: '',
      heading: 'Trusted Brands & Certifications',
      lede: '',
      logos: [],
    }),
    sanitizeData: (input): LogosSectionData =>
      sanitizeLogosSectionData(input, 'Trusted Brands & Certifications'),
  },
  before_after_section: {
    type: 'before_after_section',
    label: 'Before & After',
    fields: [
      { key: 'accent', label: 'Accent', kind: 'text' },
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'lede', label: 'Lede', kind: 'textarea' },
    ],
    createDefaultData: (): SectionTextData => ({ accent: '', heading: 'Before & After', lede: '' }),
    sanitizeData: sanitizeSectionTextData,
  },
};

export const pageTemplateRegistry: Record<string, PageTemplateDefinition> = {
  'content-page-v1': {
    key: 'content-page-v1',
    label: 'Content Page (Hero + Body + CTA)',
    editorMode: 'flexible-sections',
    slots: [
      {
        slotId: 'hero',
        label: 'Hero',
        sectionType: 'flexible_hero_section',
        required: false,
        clientCanEdit: true,
      },
      {
        slotId: 'content',
        label: 'Body Content',
        sectionType: 'rich_text_section',
        required: false,
        clientCanEdit: true,
      },
      {
        slotId: 'faq',
        label: 'FAQs',
        sectionType: 'faq_section',
        required: false,
        clientCanEdit: true,
        clientCanHide: true,
      },
      {
        slotId: 'cta',
        label: 'CTA Section',
        sectionType: 'flexible_cta_section',
        required: false,
        clientCanEdit: true,
      },
    ],
  },
  'about-page-v1': {
    key: 'about-page-v1',
    label: 'About Page',
    editorMode: 'flexible-sections',
    slots: [
      {
        slotId: 'hero',
        label: 'Hero',
        sectionType: 'flexible_hero_section',
        required: false,
        clientCanEdit: true,
        description: 'Uses the about page title and intro copy.',
      },
      {
        slotId: 'company_overview_content',
        label: 'Company Overview Content',
        sectionType: 'rich_text_section',
        required: false,
        clientCanEdit: true,
        description: 'Renders inside the Company Overview section.',
      },
      {
        slotId: 'team_grid',
        label: 'Team Grid',
        sectionType: 'team_grid_section',
        required: false,
        clientCanEdit: true,
        description: 'Auto-generated from team members.',
      },
      {
        slotId: 'latest_articles',
        label: 'Blog Grid',
        sectionType: 'blog_grid_section',
        required: false,
        clientCanEdit: true,
      },
      {
        slotId: 'cta',
        label: 'CTA Section',
        sectionType: 'flexible_cta_section',
        required: false,
        clientCanEdit: true,
      },
    ],
  },
  'contact-page-v1': {
    key: 'contact-page-v1',
    label: 'Contact Page',
    editorMode: 'flexible-sections',
    slots: [
      {
        slotId: 'page_header',
        label: 'Contact Hero',
        sectionType: 'flexible_hero_section',
        required: false,
        clientCanEdit: true,
        description: 'Uses the page title and meta description in the hero.',
      },
      {
        slotId: 'contact_form_section',
        label: 'Form + Info',
        sectionType: 'contact_form_section',
        required: false,
        clientCanEdit: true,
        description: 'Rendered from business settings + form builder config.',
      },
    ],
  },
  'blog-archive-page-v1': {
    key: 'blog-archive-page-v1',
    label: 'Blog Archive Page',
    editorMode: 'flexible-sections',
    slots: [
      {
        slotId: 'page_header',
        label: 'Hero',
        sectionType: 'flexible_hero_section',
        required: false,
        clientCanEdit: true,
        description: 'Uses the page title and meta description in the hero.',
      },
      {
        slotId: 'blog_grid',
        label: 'Blog Grid',
        sectionType: 'blog_grid_section',
        required: false,
        clientCanEdit: true,
      },
      {
        slotId: 'cta',
        label: 'CTA Section',
        sectionType: 'flexible_cta_section',
        required: false,
        clientCanEdit: true,
      },
    ],
  },
  'areas-archive-page-v1': {
    key: 'areas-archive-page-v1',
    label: 'Areas Archive Page',
    editorMode: 'flexible-sections',
    slots: [
      {
        slotId: 'page_header',
        label: 'Hero',
        sectionType: 'flexible_hero_section',
        required: false,
        clientCanEdit: true,
        description: 'Uses the page title and meta description in the hero.',
      },
      {
        slotId: 'service_areas_grid',
        label: 'Area Grid',
        sectionType: 'area_grid_section',
        required: false,
        clientCanEdit: true,
      },
      {
        slotId: 'cta',
        label: 'CTA Section',
        sectionType: 'flexible_cta_section',
        required: false,
        clientCanEdit: true,
      },
    ],
  },
  'services-archive-page-v1': {
    key: 'services-archive-page-v1',
    label: 'Services Archive Page',
    editorMode: 'flexible-sections',
    slots: [
      {
        slotId: 'page_header',
        label: 'Hero',
        sectionType: 'flexible_hero_section',
        required: false,
        clientCanEdit: true,
      },
      {
        slotId: 'service_grid',
    label: 'Service Grid',
        sectionType: 'service_grid_section',
        required: false,
        clientCanEdit: true,
      },
      {
        slotId: 'cta',
        label: 'CTA Section',
        sectionType: 'flexible_cta_section',
        required: false,
        clientCanEdit: true,
      },
    ],
  },
  'home-page-v1': {
    key: 'home-page-v1',
    label: 'Home Page',
    editorMode: 'flexible-sections',
    slots: [
      {
        slotId: 'hero',
        label: 'Hero',
        sectionType: 'flexible_hero_section',
        required: false,
        clientCanEdit: true,
        description: 'Uses the built-in home hero section.',
      },
      {
        slotId: 'services',
        label: 'Services',
        sectionType: 'service_grid_section',
        required: false,
        clientCanEdit: true,
      },
      {
        slotId: 'areas',
        label: 'Area Grid',
        sectionType: 'area_grid_section',
        required: false,
        clientCanEdit: true,
      },
      {
        slotId: 'process',
        label: 'Process',
        sectionType: 'process_section',
        required: false,
        clientCanEdit: true,
      },
      {
        slotId: 'testimonials',
        label: 'Testimonials',
        sectionType: 'testimonial_section',
        required: false,
        clientCanEdit: true,
      },
      {
        slotId: 'faq',
        label: 'FAQ Section',
        sectionType: 'faq_section',
        required: false,
        clientCanEdit: true,
      },
      {
        slotId: 'latest_articles',
        label: 'Blog Grid',
        sectionType: 'blog_grid_section',
        required: false,
        clientCanEdit: true,
      },
      {
        slotId: 'team_grid',
        label: 'Team Grid',
        sectionType: 'team_grid_section',
        required: false,
        clientCanEdit: true,
      },
      {
        slotId: 'latest_projects',
        label: 'Latest Projects',
        sectionType: 'projects_section',
        required: false,
        clientCanEdit: true,
      },
      {
        slotId: 'primary_gallery',
        label: 'Primary Gallery',
        sectionType: 'gallery_section',
        required: false,
        clientCanEdit: true,
      },
      {
        slotId: 'latest_before_after',
        label: 'Latest Before & After',
        sectionType: 'before_after_section',
        required: false,
        clientCanEdit: true,
      },
      {
        slotId: 'cta',
        label: 'CTA Section',
        sectionType: 'flexible_cta_section',
        required: false,
        clientCanEdit: true,
      },
    ],
  },
  'service-content-v1': {
    key: 'service-content-v1',
    label: 'Service Detail',
    editorMode: 'flexible-sections',
    slots: [
      {
        slotId: 'hero',
        label: 'Hero',
        sectionType: 'flexible_hero_section',
        required: false,
        clientCanEdit: true,
        description: 'Uses service title, excerpt, image, and icon.',
      },
      {
        slotId: 'content',
        label: 'Body Content',
        sectionType: 'long_form_body_section',
        required: false,
        clientCanEdit: true,
        description: 'Renders inside the main service content container.',
      },
      {
        slotId: 'service_gallery',
        label: 'Gallery',
        sectionType: 'gallery_section',
        required: false,
        clientCanEdit: true,
      },
      {
        slotId: 'process',
        label: 'Process',
        sectionType: 'process_section',
        required: false,
        clientCanEdit: true,
        description: 'Uses the default process steps for service pages.',
      },
      {
        slotId: 'other_services',
        label: 'Service Grid',
        sectionType: 'service_grid_section',
        required: false,
        clientCanEdit: true,
      },
      {
        slotId: 'related_articles',
        label: 'Blog Grid',
        sectionType: 'blog_grid_section',
        required: false,
        clientCanEdit: true,
      },
      {
        slotId: 'related_reviews',
        label: 'Testimonials',
        sectionType: 'testimonial_section',
        required: false,
        clientCanEdit: true,
      },
      {
        slotId: 'related_faqs',
        label: 'FAQ Section',
        sectionType: 'faq_section',
        required: false,
        clientCanEdit: true,
      },
      {
        slotId: 'related_projects',
        label: 'Projects',
        sectionType: 'projects_section',
        required: false,
        clientCanEdit: true,
        description: 'Managed from the Service Projects editor below.',
      },
      {
        slotId: 'before_after',
        label: 'Before & After',
        sectionType: 'before_after_section',
        required: false,
        clientCanEdit: true,
        description: 'Managed from the Before/After editor below.',
      },
      {
        slotId: 'related_areas',
        label: 'Area Grid',
        sectionType: 'area_grid_section',
        required: false,
        clientCanEdit: true,
      },
      {
        slotId: 'cta',
        label: 'CTA Section',
        sectionType: 'flexible_cta_section',
        required: false,
        clientCanEdit: true,
      },
    ],
  },
  'area-content-v1': {
    key: 'area-content-v1',
    label: 'Area Detail',
    editorMode: 'flexible-sections',
    slots: [
      {
        slotId: 'hero',
        label: 'Area Hero',
        sectionType: 'flexible_hero_section',
        required: false,
        clientCanEdit: true,
        description: 'Uses service area name and featured image.',
      },
      {
        slotId: 'content',
        label: 'Body Content',
        sectionType: 'long_form_body_section',
        required: false,
        clientCanEdit: true,
        description: 'Renders inside the main service area content container.',
      },
      {
        slotId: 'process',
        label: 'Process',
        sectionType: 'process_section',
        required: false,
        clientCanEdit: true,
      },
      {
        slotId: 'services',
        label: 'Service Grid',
        sectionType: 'service_grid_section',
        required: false,
        clientCanEdit: true,
      },
      {
        slotId: 'other_areas',
        label: 'Area Grid',
        sectionType: 'area_grid_section',
        required: false,
        clientCanEdit: true,
      },
      {
        slotId: 'latest_articles',
        label: 'Blog Grid',
        sectionType: 'blog_grid_section',
        required: false,
        clientCanEdit: true,
      },
      {
        slotId: 'gallery',
        label: 'Gallery',
        sectionType: 'gallery_section',
        required: false,
        clientCanEdit: true,
      },
      {
        slotId: 'before_after',
        label: 'Before & After',
        sectionType: 'before_after_section',
        required: false,
        clientCanEdit: true,
      },
      {
        slotId: 'cta',
        label: 'CTA Section',
        sectionType: 'flexible_cta_section',
        required: false,
        clientCanEdit: true,
      },
    ],
  },
  'blog-post-content-v1': {
    key: 'blog-post-content-v1',
    label: 'Blog Post Detail',
    editorMode: 'flexible-sections',
    slots: [
      {
        slotId: 'hero',
        label: 'Hero',
        sectionType: 'flexible_hero_section',
        required: false,
        clientCanEdit: true,
        description: 'Uses post title, excerpt, date, read time, and featured image.',
      },
      {
        slotId: 'content',
        label: 'Body Content',
        sectionType: 'long_form_body_section',
        required: false,
        clientCanEdit: true,
        description: 'Renders inside the blog post content container.',
      },
      {
        slotId: 'related_articles',
        label: 'Blog Grid',
        sectionType: 'blog_grid_section',
        required: false,
        clientCanEdit: true,
      },
      {
        slotId: 'cta',
        label: 'CTA Section',
        sectionType: 'flexible_cta_section',
        required: false,
        clientCanEdit: true,
      },
    ],
  },
};

export function listGlobalSectionCatalog() {
  return Object.values(sectionRegistry)
    .filter(
      (sectionDef) =>
        !['layout_marker', 'rich_text_section', 'content_2_column_section'].includes(sectionDef.type),
    )
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function listPageTemplates() {
  return Object.values(pageTemplateRegistry);
}

function usesFlexibleSectionEditor(template: PageTemplateDefinition) {
  return template.editorMode === 'flexible-sections';
}

function createDefaultSectionsFromTemplate(template: PageTemplateDefinition): TemplateSectionInstance[] {
  const sourceSlots = usesFlexibleSectionEditor(template)
    ? template.slots.filter((slot) => slot.clientCanEdit).filter((slot, index, slots) =>
        slots.findIndex((candidate) => candidate.slotId === slot.slotId) === index,
      )
    : template.slots;

  return sourceSlots.map((slot) => {
    const sectionDef = sectionRegistry[slot.sectionType];
    if (!sectionDef) throw new Error(`Unknown section type: ${slot.sectionType}`);
    const data = getDefaultSectionDataForTemplateSlot(template.key, slot.slotId, slot.sectionType, sectionDef);

    return {
      id: generateId(),
      slotId: slot.slotId,
      type: slot.sectionType,
      data: normalizeSectionTextMeta(data as Record<string, unknown>),
      hidden: false,
    };
  });
}

function normalizeServiceContentSections(sections: TemplateSectionInstance[]): TemplateSectionInstance[] {
  const hasOtherServicesGrid = sections.some(
    (section) => section.type === 'service_grid_section' && section.slotId === 'other_services',
  );

  return sections.flatMap((section) => {
    if (section.type !== 'service_grid_section' || section.slotId !== 'related_services') {
      return [section];
    }

    if (hasOtherServicesGrid) {
      return [];
    }

    const data = asObject(section.data);
    const heading = asString(data.heading).trim();
    const normalizedHeading =
      !heading || heading === 'Related Services' ? 'Other {{parent_service}} Services' : heading;

    return [
      {
        ...section,
        slotId: 'other_services',
        data: normalizeSectionTextMeta({
          ...data,
          heading: normalizedHeading,
        }),
      },
    ];
  });
}

function orderSectionsByTemplateSlots(templateKey: string, sections: TemplateSectionInstance[]): TemplateSectionInstance[] {
  const template = pageTemplateRegistry[templateKey];
  if (!template) return sections;

  const slotOrder = new Map(template.slots.map((slot, index) => [slot.slotId, index] as const));

  return sections
    .map((section, index) => ({ section, index }))
    .sort((a, b) => {
      const aOrder = slotOrder.get(a.section.slotId) ?? Number.MAX_SAFE_INTEGER;
      const bOrder = slotOrder.get(b.section.slotId) ?? Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.index - b.index;
    })
    .map(({ section }) => section);
}

export function isBasicBlockArrayContent(content: unknown): content is BasicBlock[] {
  if (!Array.isArray(content)) return false;
  return content.every((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const row = value as Record<string, unknown>;
    return typeof row.type === 'string' && row.data && typeof row.data === 'object' && !Array.isArray(row.data);
  });
}

export function createTemplatePageContent(templateKey: string): TemplatePageContent {
  const template = pageTemplateRegistry[templateKey];
  if (!template) throw new Error(`Unknown template: ${templateKey}`);

  return {
    kind: 'template-page',
    version: 1,
    templateKey: template.key,
    sections: createDefaultSectionsFromTemplate(template),
  };
}

export function toTemplatePageContent(content: unknown): TemplatePageContent | null {
  try {
    return sanitizeTemplatePageContent(content);
  } catch {
    return null;
  }
}

function sanitizeBasicBlocks(input: unknown): BasicBlock[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
      const row = value as Record<string, unknown>;
      if (typeof row.type !== 'string') return null;
      const data = asObject(row.data);
      return { type: row.type, data };
    })
    .filter((value): value is BasicBlock => Boolean(value));
}

export function sanitizeTemplatePageContent(input: unknown): TemplatePageContent {
  const root = asObject(input);
  if (root.kind !== 'template-page') {
    throw new Error('Not template page content');
  }

  const templateKey = asString(root.templateKey);
  const template = pageTemplateRegistry[templateKey];
  if (!template) {
    throw new Error('Unknown template key');
  }

  const rawSections = asArray(root.sections).map((item) => asObject(item));

  if (usesFlexibleSectionEditor(template)) {
    const templateSlotById = new Map(template.slots.map((slot) => [slot.slotId, slot] as const));
    const sections = rawSections
      .map((rawSection, index) => {
        const rawType = asString(rawSection.type);
        const rawSlotId = asString(rawSection.slotId);
        const slot = rawSlotId ? templateSlotById.get(rawSlotId) : undefined;
        const type =
          rawType === 'layout_marker' && slot && slot.sectionType !== 'layout_marker'
            ? slot.sectionType
            : rawType;
        const def = sectionRegistry[type];
        if (!type || !def || type === 'layout_marker') return null;

        const slotId = rawSlotId || `custom_${type}_${index + 1}`;
        const rawData = asObject(rawSection.data);
        const hasRawData = Object.keys(rawData).length > 0;
        return {
          id: asString(rawSection.id) || generateId(),
          slotId,
          type,
          hidden: asBoolean(rawSection.hidden),
          data: normalizeSectionTextMeta(
            (hasRawData ? def.sanitizeData(rawSection.data) : getDefaultSectionDataForTemplateSlot(templateKey, slotId, type, def)) as Record<string, unknown>,
          ),
        };
      })
      .filter(Boolean) as TemplateSectionInstance[];

    const normalizedSections = templateKey === 'service-content-v1'
      ? orderSectionsByTemplateSlots(templateKey, normalizeServiceContentSections(sections))
      : sections;

    return {
      kind: 'template-page',
      version: 1,
      templateKey,
      sections: normalizedSections,
    };
  }

  const rawBySlot = new Map<string, Record<string, unknown>>();
  for (const rawSection of rawSections) {
    const slotId = asString(rawSection.slotId);
    if (slotId) rawBySlot.set(slotId, rawSection);
  }

  const sections = template.slots.map((slot) => {
    const raw = rawBySlot.get(slot.slotId) ?? {};
    const def = sectionRegistry[slot.sectionType];
    if (!def) throw new Error(`Unknown section type: ${slot.sectionType}`);
    return {
      id: asString(raw.id) || generateId(),
      slotId: slot.slotId,
      type: slot.sectionType,
      hidden: slot.clientCanHide ? asBoolean(raw.hidden) : false,
      data: normalizeSectionTextMeta(def.sanitizeData(raw.data) as Record<string, unknown>),
    };
  });

  return {
    kind: 'template-page',
    version: 1,
    templateKey,
    sections,
  };
}

export function sanitizePageContentForSave(input: unknown): TemplatePageContent | BasicBlock[] {
  if (isBasicBlockArrayContent(input)) return sanitizeBasicBlocks(input);
  return sanitizeTemplatePageContent(input);
}

export function convertBasicBlocksToTemplatePageContent(
  input: unknown,
  templateKey: string,
  fallbackHeading = 'Overview',
): TemplatePageContent | null {
  if (!isBasicBlockArrayContent(input)) return null;

  const blocks = sanitizeBasicBlocks(input);
  if (blocks.length === 0) return null;

  let heading = '';
  const bodyParts: string[] = [];

  for (const block of blocks) {
    if (block.type === 'heading') {
      const text = asString(block.data.text).trim();
      if (!text) continue;
      if (!heading) {
        heading = text;
      } else {
        bodyParts.push(text);
      }
      continue;
    }

    if (block.type === 'paragraph') {
      const text = asString(block.data.text).trim();
      if (text) {
        bodyParts.push(text);
      }
      continue;
    }

    if (block.type === 'list') {
      const items = asArray(block.data.items)
        .map((item) => asString(item).trim())
        .filter(Boolean);
      if (items.length > 0) {
        const listBlock = items.map((item) => `- ${item}`).join('\n');
        bodyParts.push(listBlock);
      }
    }
  }

  const content = createTemplatePageContent(templateKey);
  const contentSection = content.sections.find((section) => section.slotId === 'content');
  if (!contentSection) return content;

  if (contentSection.type === 'rich_text_section') {
    contentSection.data = sectionRegistry.rich_text_section.sanitizeData({
      heading: heading || fallbackHeading,
      lede: bodyParts.join('\n\n'),
    });
    return content;
  }

  if (contentSection.type === 'long_form_body_section') {
    contentSection.data = sectionRegistry.long_form_body_section.sanitizeData({ blocks });
  }

  return content;
}

function setValueAtPath(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) return;

  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i];
    const next = cursor[key];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      cursor[key] = {};
    }
    cursor = cursor[key] as Record<string, unknown>;
  }

  cursor[parts[parts.length - 1]] = value;
}

function maybeParseFaqJson(raw: unknown) {
  if (typeof raw !== 'string') return raw;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // ignore invalid JSON; sanitize step will strip it
  }
  return raw;
}

export function applyFlatImportToTemplatePageContent(
  content: TemplatePageContent,
  values: Record<string, unknown>,
): TemplatePageContent {
  const template = pageTemplateRegistry[content.templateKey];
  if (!template) return content;

  if (usesFlexibleSectionEditor(template)) {
    const nextSections = content.sections.map((section) => {
      const def = sectionRegistry[section.type];
      if (!def) return section;

      const draft = { ...asObject(section.data) };
      const aliases = def.importAliases ?? {};

      for (const [flatKey, path] of Object.entries(aliases)) {
        if (!(flatKey in values)) continue;
        const rawValue = flatKey === 'faqs_json' ? maybeParseFaqJson(values[flatKey]) : values[flatKey];
        setValueAtPath(draft, path, rawValue);
      }

      return {
        ...section,
        data: normalizeSectionTextMeta(def.sanitizeData(draft) as Record<string, unknown>),
      };
    });

    return {
      ...content,
      sections: nextSections,
    };
  }

  const nextSections = content.sections.map((section) => {
    const slot = template.slots.find((item) => item.slotId === section.slotId);
    const def = slot ? sectionRegistry[slot.sectionType] : null;
    if (!slot || !def) return section;

    const draft = { ...asObject(section.data) };
    const aliases = def.importAliases ?? {};

    for (const [flatKey, path] of Object.entries(aliases)) {
      if (!(flatKey in values)) continue;
      const rawValue = flatKey === 'faqs_json' ? maybeParseFaqJson(values[flatKey]) : values[flatKey];
      setValueAtPath(draft, path, rawValue);
    }

    return {
      ...section,
      data: normalizeSectionTextMeta(def.sanitizeData(draft) as Record<string, unknown>),
    };
  });

  return {
    ...content,
    sections: nextSections,
  };
}










