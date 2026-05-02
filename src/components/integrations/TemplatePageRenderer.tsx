import { Fragment } from 'react';
import {
  type TemplatePageRenderContext,
  type TemplatePageRendererAdapter,
} from '@/lib/sections-core/TemplatePageRenderer';
import LegacyRenderedSection from '@/lib/sections-core/template-renderer/renderedSection';
import type { TemplatePageContent } from '@/lib/sections/templatePages';
import { initializeSectionsServerRuntime } from '@/lib/sections/runtime.server';
import { getActiveSystemPageHrefs, getPrimaryServiceGalleryImages } from '@/lib/content/queries';
import { getActiveFormById } from '@/lib/forms/queries';
import { applyAreaCardExcerptSetting, applyServiceCardExcerptSetting } from '@/lib/frontend/cardExcerpts';
import { getBusiness, getBusinessSettingString } from '@/lib/utils/business';
import { getSharedSectionsFromSettings, resolveSharedSectionsInContent } from '@/lib/sections/sharedSections';
import AppImage from '@/components/shared/AppImage';
import MarkdownLite from '@/components/shared/MarkdownLite';
import BlockRenderer from '@/components/shared/BlockRenderer';
import ManagedFrontendForm from '@/components/frontend/ManagedFrontendForm';
import PrimaryButton from '@/components/frontend/PrimaryButton';
import Hero from '@/components/frontend/Hero';
import IconValue from '@/components/shared/IconValue';
import {
  BeforeAfterSection,
  BlogGridSection,
  BlogPageHero,
  CalloutQuoteSection,
  FaqSection,
  GallerySection,
  LogosSection,
  getDefaultProcessSteps,
  PageHero,
  ProcessSection,
  ProjectsSection,
  OwnerSpotlightSection,
  AreaPageHero,
  AreaGridSection,
  ServiceCard,
  ServiceGridSection,
  ServicePageHero,
  TeamCard,
  TeamGridSection,
  TestimonialSection,
} from '@/lib/sections-core/frontend';
import { renderCanonicalSection } from '@/components/integrations/CanonicalSectionRenderer';
import { isCanonicalSectionData } from '@/lib/sections/canonicalSections';

interface RhythmImage {
  id: string;
  file_url: string;
  caption?: string | null;
}

type AppTemplatePageRenderContext = TemplatePageRenderContext & {
  archivePaths?: {
    services?: string;
    areas?: string;
  };
  hasFamilyTestimonials?: boolean;
  rhythmImages?: RhythmImage[];
  gallerySectionImages?: RhythmImage[];
};

interface TemplatePageRendererProps {
  content: TemplatePageContent;
  context?: AppTemplatePageRenderContext;
}

function applyGlobalCtaSettings(
  content: TemplatePageContent,
  ctaDefaults: NonNullable<TemplatePageRenderContext['ctaDefaults']>,
): TemplatePageContent {
  return {
    ...content,
    sections: content.sections.map((section) => {
      const data =
        section.data && typeof section.data === 'object' && !Array.isArray(section.data)
          ? { ...(section.data as Record<string, unknown>) }
          : {};

      if (section.type === 'home_hero_section') {
        data.primaryCtaText = ctaDefaults.primaryLabel ?? '';
        data.secondaryCtaText = ctaDefaults.secondaryLabel ?? '';
        data.secondaryCtaHref = ctaDefaults.secondaryHref ?? '';
        return { ...section, data };
      }

      if (section.type === 'hero_standard') {
        const primaryCta =
          data.primaryCta && typeof data.primaryCta === 'object' && !Array.isArray(data.primaryCta)
            ? { ...(data.primaryCta as Record<string, unknown>) }
            : {};
        primaryCta.text = ctaDefaults.primaryLabel ?? '';
        data.primaryCta = primaryCta;
        return { ...section, data };
      }

      if (section.type === 'cta_band') {
        const cta =
          data.cta && typeof data.cta === 'object' && !Array.isArray(data.cta)
            ? { ...(data.cta as Record<string, unknown>) }
            : {};
        cta.text = ctaDefaults.primaryLabel ?? '';
        data.cta = cta;
        return { ...section, data };
      }

      return section;
    }),
  };
}

const templatePageRendererAdapter: TemplatePageRendererAdapter = {
  getActiveFormById,
  getPrimaryServiceGalleryImages,
  getDefaultProcessSteps,
  components: {
    AppImage,
    MarkdownLite,
    BlockRenderer,
    PrimaryButton,
    Hero,
    ServiceGridSection,
    ServiceCard,
    TestimonialSection,
    FaqSection,
    ProjectsSection,
    FrontendForm: ManagedFrontendForm,
    PageHero,
    IconValue,
    BlogPageHero,
    AreaPageHero,
    ServicePageHero,
    BeforeAfterSection,
    GallerySection,
    LogosSection,
    BlogGridSection,
    CalloutQuoteSection,
    ProcessSection,
    OwnerSpotlightSection,
    AreaGridSection,
    TeamGridSection,
  },
};

export default async function TemplatePageRenderer({ content, context }: TemplatePageRendererProps) {
  initializeSectionsServerRuntime();
  const [business, systemPageHrefs] = await Promise.all([getBusiness(), getActiveSystemPageHrefs()]);
  const businessSettings = business?.settings;
  const sharedSections = getSharedSectionsFromSettings(businessSettings);
  const ctaDefaults = {
    primaryLabel: getBusinessSettingString(businessSettings, 'primary_cta_label') || 'Get a Quote',
    primaryHref: systemPageHrefs.contact || '/contact',
    secondaryLabel: getBusinessSettingString(businessSettings, 'secondary_cta_label') || 'Our Services',
    secondaryHref:
      getBusinessSettingString(businessSettings, 'secondary_cta_link') ||
      systemPageHrefs.services ||
      '/services',
  };
  const nextServices = applyServiceCardExcerptSetting(context?.services ?? [], businessSettings);
  const nextAllServices =
    context?.allServices && context.allServices !== context?.services
      ? applyServiceCardExcerptSetting(context.allServices, businessSettings)
      : nextServices;
  const nextChildServices = context?.childServices
    ? applyServiceCardExcerptSetting(context.childServices, businessSettings)
    : undefined;
  const nextParentService = context?.parentService
    ? applyServiceCardExcerptSetting([context.parentService], businessSettings)[0] ?? null
    : context?.parentService;
  const nextAreas = applyAreaCardExcerptSetting(context?.serviceAreas ?? [], businessSettings);
  const mergedContext: TemplatePageRenderContext | undefined = context
    ? {
        ...context,
        services: nextServices,
        allServices: nextAllServices,
        childServices: nextChildServices,
        parentService: nextParentService,
        serviceAreas: nextAreas,
        ctaDefaults,
      }
    : {
        ctaDefaults,
      };
  const resolvedContent = applyGlobalCtaSettings(resolveSharedSectionsInContent(content, sharedSections), ctaDefaults);
  const firstVisibleSectionIndex = resolvedContent.sections.findIndex((section) => section.hidden !== true);
  let canonicalToneIndex = 0;
  const renderedSections = await Promise.all(
    resolvedContent.sections.map(async (section, index) => {
      if (section.hidden === true) {
        return null;
      }

      const sectionData =
        section.data && typeof section.data === 'object' && !Array.isArray(section.data)
          ? (section.data as Record<string, unknown>)
          : null;

      if (sectionData && isCanonicalSectionData(sectionData)) {
        const toneIndex = canonicalToneIndex;
        canonicalToneIndex += 1;
        const canonical = await renderCanonicalSection({
          section,
          context: mergedContext,
          adapter: templatePageRendererAdapter,
          isFirstSection: index === firstVisibleSectionIndex,
          toneIndex,
        });

        if (canonical) {
          return (
            <Fragment key={section.id}>
              {canonical}
            </Fragment>
          );
        }
      }

      return (
        <LegacyRenderedSection
          key={section.id}
          section={section}
          context={mergedContext}
          adapter={templatePageRendererAdapter}
          isFirstSection={index === firstVisibleSectionIndex}
        />
      );
    }),
  );

  return <>{renderedSections}</>;
}

export type { AppTemplatePageRenderContext as TemplatePageRenderContext };

