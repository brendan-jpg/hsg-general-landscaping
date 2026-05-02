import { convertBasicBlocksToTemplatePageContent, toTemplatePageContent } from '@/lib/sections/templatePages';
import { getBusinessSettingBoolean } from '@/lib/utils/business';

const CARD_EXCERPT_WORD_LIMIT = 15;

type ContentBlock = {
  type?: string;
  data?: Record<string, unknown>;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function stripHtml(value: string) {
  return normalizeWhitespace(value.replace(/<[^>]*>/g, ' '));
}

function truncateToWordCount(value: string, wordCount = CARD_EXCERPT_WORD_LIMIT) {
  const words = normalizeWhitespace(value).split(' ').filter(Boolean);
  if (words.length === 0) return null;
  return `${words.slice(0, wordCount).join(' ')}...`;
}

function getBlockText(block: ContentBlock) {
  const type = typeof block.type === 'string' ? block.type : '';
  const data = block.data && typeof block.data === 'object' && !Array.isArray(block.data) ? block.data : {};

  switch (type) {
    case 'heading':
    case 'paragraph':
    case 'quote':
      return typeof data.text === 'string' ? data.text : '';
    case 'list':
      return Array.isArray(data.items)
        ? data.items.filter((item): item is string => typeof item === 'string').join(' ')
        : '';
    case 'html':
      return typeof data.html === 'string' ? stripHtml(data.html) : '';
    default:
      return '';
  }
}

function extractLongFormText(content: unknown, templateKey: string, fallbackHeading: string) {
  const templateContent =
    toTemplatePageContent(content) ??
    convertBasicBlocksToTemplatePageContent(content, templateKey, fallbackHeading);

  const longFormSection = templateContent?.sections.find((section) => section.type === 'long_form_body_section');
  const blocks = Array.isArray(longFormSection?.data?.blocks)
    ? longFormSection.data.blocks.filter(
        (block): block is ContentBlock =>
          Boolean(block) && typeof block === 'object' && !Array.isArray(block),
      )
    : [];

  return normalizeWhitespace(blocks.map((block) => getBlockText(block)).filter(Boolean).join(' '));
}

function buildExcerptFromLongForm(content: unknown, templateKey: string, fallbackHeading: string) {
  const longFormText = extractLongFormText(content, templateKey, fallbackHeading);
  if (!longFormText) return null;
  return truncateToWordCount(longFormText);
}

type ServiceCardRecord = {
  title?: string | null;
  excerpt?: string | null;
  content?: unknown;
};

type AreaCardRecord = {
  name?: string | null;
  content?: unknown;
  excerpt?: string | null;
};

export function applyServiceCardExcerptSetting<T extends ServiceCardRecord>(services: T[], settings: unknown): T[] {
  if (!getBusinessSettingBoolean(settings, 'service_card_show_excerpts')) {
    return services.map((service) => ({
      ...service,
      excerpt: null,
    }));
  }

  return services.map((service) => ({
    ...service,
    excerpt:
      buildExcerptFromLongForm(service.content, 'service-content-v1', service.title?.trim() || 'Overview') ??
      (typeof service.excerpt === 'string' ? service.excerpt.trim() : null),
  }));
}

export function applyAreaCardExcerptSetting<T extends AreaCardRecord>(areas: T[], settings: unknown): T[] {
  if (!getBusinessSettingBoolean(settings, 'area_card_show_excerpts')) {
    return areas.map((area) => ({
      ...area,
      excerpt: null,
    }));
  }

  return areas.map((area) => ({
    ...area,
    excerpt: buildExcerptFromLongForm(area.content, 'area-content-v1', area.name?.trim() || 'Overview'),
  }));
}
