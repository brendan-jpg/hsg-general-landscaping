export type TemplateFieldKind =
  | 'text'
  | 'textarea'
  | 'url'
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
  kind: 'text' | 'textarea' | 'url';
  placeholder?: string;
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

export type TemplateFieldDef =
  | TemplateTextField
  | TemplateBooleanField
  | TemplateNumberField
  | TemplateGroupField
  | TemplateListField;

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

function generateId() {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `section-${Math.random().toString(36).slice(2, 10)}`;
}

type HeroStandardData = {
  headline: string;
  body: string;
  primaryCta: { text: string; href: string };
};

type RichTextSectionData = {
  heading: string;
  body: string;
};

type FaqListData = {
  heading: string;
  items: Array<{ question: string; answer: string }>;
};

type CtaBandData = {
  heading: string;
  body: string;
  cta: { text: string; href: string };
};

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
    label: 'Hero',
    fields: [
      { key: 'headline', label: 'Headline', kind: 'text', required: true, placeholder: 'Main headline' },
      { key: 'body', label: 'Body', kind: 'textarea', placeholder: 'Supporting copy' },
      {
        key: 'primaryCta',
        label: 'Primary CTA',
        kind: 'group',
        fields: [
          { key: 'text', label: 'Button Text', kind: 'text' },
          { key: 'href', label: 'Button URL', kind: 'url', placeholder: '/contact' },
        ],
      },
    ],
    createDefaultData: (): HeroStandardData => ({
      headline: '',
      body: '',
      primaryCta: { text: '', href: '' },
    }),
    sanitizeData: (input: unknown): HeroStandardData => {
      const obj = asObject(input);
      const cta = asObject(obj.primaryCta);
      return {
        headline: asString(obj.headline).trim(),
        body: asString(obj.body).trim(),
        primaryCta: {
          text: asString(cta.text).trim(),
          href: asString(cta.href).trim(),
        },
      };
    },
    importAliases: {
      hero_headline: 'headline',
      hero_body: 'body',
      hero_cta_text: 'primaryCta.text',
      hero_cta_href: 'primaryCta.href',
    },
  },
  rich_text_section: {
    type: 'rich_text_section',
    label: 'Text Content',
    fields: [
      { key: 'heading', label: 'Heading', kind: 'text' },
      { key: 'body', label: 'Body', kind: 'textarea', required: true },
    ],
    createDefaultData: (): RichTextSectionData => ({ heading: '', body: '' }),
    sanitizeData: (input: unknown): RichTextSectionData => {
      const obj = asObject(input);
      return {
        heading: asString(obj.heading).trim(),
        body: asString(obj.body).trim(),
      };
    },
    importAliases: {
      content_heading: 'heading',
      content_body: 'body',
      intro_heading: 'heading',
      intro_body: 'body',
    },
  },
  faq_list: {
    type: 'faq_list',
    label: 'FAQ List',
    fields: [
      { key: 'heading', label: 'Heading', kind: 'text' },
      {
        key: 'items',
        label: 'FAQs',
        kind: 'list',
        itemLabel: 'FAQ',
        itemSchema: {
          key: 'faq_item',
          label: 'FAQ Item',
          kind: 'group',
          fields: [
            { key: 'question', label: 'Question', kind: 'text', required: true },
            { key: 'answer', label: 'Answer', kind: 'textarea', required: true },
          ],
        },
      },
    ],
    createDefaultData: (): FaqListData => ({ heading: '', items: [] }),
    sanitizeData: (input: unknown): FaqListData => {
      const obj = asObject(input);
      const items = asArray(obj.items)
        .map((item) => asObject(item))
        .map((item) => ({
          question: asString(item.question).trim(),
          answer: asString(item.answer).trim(),
        }))
        .filter((item) => item.question || item.answer);

      return {
        heading: asString(obj.heading).trim(),
        items,
      };
    },
    importAliases: {
      faq_heading: 'heading',
      faqs_json: 'items',
    },
  },
  cta_band: {
    type: 'cta_band',
    label: 'CTA Band',
    fields: [
      { key: 'heading', label: 'Heading', kind: 'text', required: true },
      { key: 'body', label: 'Body', kind: 'textarea' },
      {
        key: 'cta',
        label: 'CTA',
        kind: 'group',
        fields: [
          { key: 'text', label: 'Button Text', kind: 'text', required: true },
          { key: 'href', label: 'Button URL', kind: 'url', required: true },
        ],
      },
    ],
    createDefaultData: (): CtaBandData => ({
      heading: '',
      body: '',
      cta: { text: '', href: '' },
    }),
    sanitizeData: (input: unknown): CtaBandData => {
      const obj = asObject(input);
      const cta = asObject(obj.cta);
      return {
        heading: asString(obj.heading).trim(),
        body: asString(obj.body).trim(),
        cta: {
          text: asString(cta.text).trim(),
          href: asString(cta.href).trim(),
        },
      };
    },
    importAliases: {
      cta_heading: 'heading',
      cta_body: 'body',
      cta_text: 'cta.text',
      cta_href: 'cta.href',
    },
  },
};

export const pageTemplateRegistry: Record<string, PageTemplateDefinition> = {
  'content-page-v1': {
    key: 'content-page-v1',
    label: 'Content Page (Hero + Body + CTA)',
    slots: [
      {
        slotId: 'hero',
        label: 'Hero',
        sectionType: 'hero_standard',
        required: true,
        clientCanEdit: true,
      },
      {
        slotId: 'content',
        label: 'Main Content',
        sectionType: 'rich_text_section',
        required: true,
        clientCanEdit: true,
      },
      {
        slotId: 'faq',
        label: 'FAQs',
        sectionType: 'faq_list',
        required: false,
        clientCanEdit: true,
        clientCanHide: true,
      },
      {
        slotId: 'cta',
        label: 'Call To Action',
        sectionType: 'cta_band',
        required: true,
        clientCanEdit: true,
      },
    ],
  },
  'about-page-v1': {
    key: 'about-page-v1',
    label: 'About Page (Route Layout Mirror)',
    slots: [
      {
        slotId: 'page_header',
        label: 'Header (Route)',
        sectionType: 'layout_marker',
        required: true,
        clientCanEdit: false,
        description: 'Uses page title and meta description in the route header.',
      },
      {
        slotId: 'company_overview_content',
        label: 'Company Overview Content',
        sectionType: 'rich_text_section',
        required: true,
        clientCanEdit: true,
        description: 'Renders inside the Company Overview section.',
      },
      {
        slotId: 'owner_spotlight',
        label: 'Owner Spotlight (Route)',
        sectionType: 'layout_marker',
        required: true,
        clientCanEdit: false,
        description: 'Auto-generated from team members.',
      },
      {
        slotId: 'team_grid',
        label: 'Team Grid (Route)',
        sectionType: 'layout_marker',
        required: true,
        clientCanEdit: false,
        description: 'Auto-generated from team members.',
      },
    ],
  },
  'contact-page-v1': {
    key: 'contact-page-v1',
    label: 'Contact Page (Route Layout Mirror)',
    slots: [
      {
        slotId: 'page_header',
        label: 'Header (Route)',
        sectionType: 'layout_marker',
        required: true,
        clientCanEdit: false,
        description: 'Uses page title and meta description in the route header.',
      },
      {
        slotId: 'contact_intro_content',
        label: 'Top Content',
        sectionType: 'rich_text_section',
        required: false,
        clientCanEdit: true,
        clientCanHide: true,
        description: 'Optional content above the contact form section.',
      },
      {
        slotId: 'contact_form_section',
        label: 'Contact Form + Info (Route)',
        sectionType: 'layout_marker',
        required: true,
        clientCanEdit: false,
        description: 'Rendered from business settings + form builder config.',
      },
    ],
  },
  'service-content-v1': {
    key: 'service-content-v1',
    label: 'Service Detail (Route Layout Mirror)',
    slots: [
      {
        slotId: 'hero',
        label: 'Hero (Route)',
        sectionType: 'layout_marker',
        required: true,
        clientCanEdit: false,
        description: 'Uses service title, excerpt, image, and icon.',
      },
      {
        slotId: 'intro',
        label: 'Intro (Route)',
        sectionType: 'layout_marker',
        required: true,
        clientCanEdit: false,
        description: 'Intro copy is generated from service excerpt/title.',
      },
      {
        slotId: 'content',
        label: 'Main Content (Editable)',
        sectionType: 'rich_text_section',
        required: true,
        clientCanEdit: true,
        description: 'Renders inside the main service content container.',
      },
      {
        slotId: 'content_cta',
        label: 'Inline CTA (Optional)',
        sectionType: 'cta_band',
        required: false,
        clientCanEdit: true,
        clientCanHide: true,
        description: 'Optional custom CTA within the editable content region.',
      },
      {
        slotId: 'process',
        label: 'Process (Route)',
        sectionType: 'layout_marker',
        required: true,
        clientCanEdit: false,
        description: 'Default process steps are route-driven.',
      },
      {
        slotId: 'related_services',
        label: 'Related Services (Route)',
        sectionType: 'layout_marker',
        required: true,
        clientCanEdit: false,
      },
      {
        slotId: 'related_articles',
        label: 'Related Articles (Route)',
        sectionType: 'layout_marker',
        required: true,
        clientCanEdit: false,
      },
      {
        slotId: 'related_reviews',
        label: 'Related Reviews (Route)',
        sectionType: 'layout_marker',
        required: true,
        clientCanEdit: false,
      },
      {
        slotId: 'related_faqs',
        label: 'Related FAQs (Route)',
        sectionType: 'layout_marker',
        required: true,
        clientCanEdit: false,
      },
      {
        slotId: 'projects',
        label: 'Projects (Route)',
        sectionType: 'layout_marker',
        required: true,
        clientCanEdit: false,
        description: 'Managed from the Service Projects editor below.',
      },
      {
        slotId: 'gallery',
        label: 'Related Gallery (Route)',
        sectionType: 'layout_marker',
        required: true,
        clientCanEdit: false,
      },
      {
        slotId: 'before_after',
        label: 'Before & After (Route)',
        sectionType: 'layout_marker',
        required: true,
        clientCanEdit: false,
        description: 'Managed from the Before/After editor below.',
      },
      {
        slotId: 'related_areas',
        label: 'Related Areas (Route)',
        sectionType: 'layout_marker',
        required: true,
        clientCanEdit: false,
      },
    ],
  },
  'area-content-v1': {
    key: 'area-content-v1',
    label: 'Area Detail (Route Layout Mirror)',
    slots: [
      {
        slotId: 'hero',
        label: 'Hero (Route)',
        sectionType: 'layout_marker',
        required: true,
        clientCanEdit: false,
        description: 'Uses Area name and featured image.',
      },
      {
        slotId: 'intro',
        label: 'Intro (Route)',
        sectionType: 'layout_marker',
        required: true,
        clientCanEdit: false,
        description: 'Intro copy is route-generated.',
      },
      {
        slotId: 'content',
        label: 'Main Content (Editable)',
        sectionType: 'rich_text_section',
        required: true,
        clientCanEdit: true,
        description: 'Renders inside the main Area content container.',
      },
      {
        slotId: 'content_cta',
        label: 'Inline CTA (Optional)',
        sectionType: 'cta_band',
        required: false,
        clientCanEdit: true,
        clientCanHide: true,
        description: 'Optional custom CTA within the editable content region.',
      },
      {
        slotId: 'process',
        label: 'Process (Route)',
        sectionType: 'layout_marker',
        required: true,
        clientCanEdit: false,
      },
      {
        slotId: 'related_reviews',
        label: 'Related Reviews (Route)',
        sectionType: 'layout_marker',
        required: true,
        clientCanEdit: false,
      },
      {
        slotId: 'related_faqs',
        label: 'Related FAQs (Route)',
        sectionType: 'layout_marker',
        required: true,
        clientCanEdit: false,
      },
      {
        slotId: 'related_articles',
        label: 'Related Articles (Route)',
        sectionType: 'layout_marker',
        required: true,
        clientCanEdit: false,
      },
      {
        slotId: 'area_projects',
        label: 'Area Projects (Route)',
        sectionType: 'layout_marker',
        required: true,
        clientCanEdit: false,
      },
      {
        slotId: 'gallery',
        label: 'Related Gallery (Route)',
        sectionType: 'layout_marker',
        required: true,
        clientCanEdit: false,
      },
      {
        slotId: 'before_after',
        label: 'Related Before & After (Route)',
        sectionType: 'layout_marker',
        required: true,
        clientCanEdit: false,
      },
      {
        slotId: 'related_services',
        label: 'Related Services (Route)',
        sectionType: 'layout_marker',
        required: true,
        clientCanEdit: false,
      },
    ],
  },
};

export function listPageTemplates() {
  return Object.values(pageTemplateRegistry);
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
    sections: template.slots.map((slot) => {
      const sectionDef = sectionRegistry[slot.sectionType];
      if (!sectionDef) throw new Error(`Unknown section type: ${slot.sectionType}`);

      return {
        id: generateId(),
        slotId: slot.slotId,
        type: slot.sectionType,
        data: sectionDef.createDefaultData(),
        hidden: false,
      };
    }),
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
      data: def.sanitizeData(raw.data),
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
      data: def.sanitizeData(draft),
    };
  });

  return {
    ...content,
    sections: nextSections,
  };
}
