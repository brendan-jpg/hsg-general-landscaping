import type { ComponentType, ReactNode } from 'react';
import { getPublicFaqs } from '@/lib/content/queries';
import type { TemplateSectionInstance } from '@/lib/sections/templatePages';
import {
  getAlternatingCanonicalBackgroundTone,
  isCanonicalLockedSectionType,
  normalizeCanonicalContentLayout,
  usesCanonicalSectionSystem,
} from '@/lib/sections/canonicalSections';
import type { TemplatePageRenderContext, TemplatePageRendererAdapter } from '@/lib/sections-core/TemplatePageRenderer';
import { toFrontendFormFields } from '@/lib/sections-core/template-renderer/shared';
import { buildAreaPath, buildServicePath } from '@/lib/utils/publicPaths';

interface CanonicalSectionRendererProps {
  section: TemplateSectionInstance;
  context?: TemplatePageRenderContext;
  adapter: TemplatePageRendererAdapter;
  isFirstSection?: boolean;
  toneIndex?: number;
}

function getSettingsString(settings: unknown, key: string) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return '';
  const value = (settings as Record<string, unknown>)[key];
  return typeof value === 'string' ? value.trim() : '';
}

function getString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function getBoolean(value: unknown) {
  return value === true;
}

function interpolate(template: string, context?: TemplatePageRenderContext) {
  const business = context?.business ?? context?.contact?.business ?? null;
  const primaryService =
    context?.services?.find((item) => item.is_primary)?.title ??
    context?.service?.title ??
    '';
  const stateRaw = (business?.state ?? '').trim();
  const stateCode = /^[a-z]{2}$/i.test(stateRaw) ? stateRaw.toUpperCase() : '';
  const domain = (business?.domain ?? '').trim().replace(/^https?:\/\//, '').replace(/\/+$/, '');

  const tokens: Record<string, string> = {
    business: business?.name ?? '',
    city: business?.city ?? '',
    state: business?.state ?? '',
    state_code: stateCode,
    primary_area: business?.city ?? '',
    primary_service: primaryService,
    parent_service: context?.parentService?.title ?? context?.service?.title ?? '',
    page: context?.page?.title ?? '',
    service: context?.service?.title ?? '',
    area: context?.area?.name ?? '',
    location: context?.area?.name ?? '',
    post: context?.blogPost?.title ?? '',
    blog_post: context?.blogPost?.title ?? '',
    url: context?.url ?? '',
    site_url: domain ? `https://${domain}` : '',
  };

  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => tokens[key] ?? '');
}

function getSectionClasses(data: Record<string, unknown>, toneIndex = 0) {
  const backgroundTone = getString(data.backgroundTone).trim();
  const backgroundPattern = getString(data.backgroundPattern).trim();
  const hasExplicitDarkTone = backgroundTone === 'dark' || getBoolean(data.hasDarkBackground);
  const hasExplicitLightTone = backgroundTone === 'light' || getBoolean(data.hasLightBackground);
  const fallbackTone = !hasExplicitDarkTone && !hasExplicitLightTone
    ? getAlternatingCanonicalBackgroundTone(toneIndex)
    : '';
  const resolvedTone = hasExplicitDarkTone
    ? 'dark'
    : hasExplicitLightTone
      ? 'light'
      : fallbackTone;

  return [
    resolvedTone === 'dark' ? 'bg-dark' : '',
    resolvedTone === 'light' ? 'bg-light' : '',
    backgroundPattern === 'pattern_1' ? 'bg-1' : '',
    backgroundPattern === 'pattern_2' ? 'bg-2' : '',
    backgroundPattern === 'pattern_3' ? 'bg-3' : '',
  ].filter(Boolean).join(' ');
}

function getContainerClasses(data: Record<string, unknown>, layout: string) {
  return [
    'container',
    getBoolean(data.isCentered) ? 'content-center' : '',
    layout === 'stack_2_text_top' || layout === 'stack_2_text_bottom' ? 'grid-1' : '',
    layout === 'row_2_text_left' || layout === 'row_2_text_right' || layout === 'two_column_text_left' || layout === 'two_column_text_right' ? 'grid-2' : '',
  ].filter(Boolean).join(' ');
}

function getContentPlacementClass(layout: string) {
  if (layout === 'stack_2_text_top') return 'col-1';
  if (layout === 'stack_2_text_bottom') return 'col-2';
  if (layout === 'row_2_text_left' || layout === 'two_column_text_left') return 'col-1';
  if (layout === 'row_2_text_right' || layout === 'two_column_text_right') return 'col-2';
  return '';
}

function getSupportingPlacementClass(layout: string) {
  if (layout === 'stack_2_text_top') return 'col-2';
  if (layout === 'stack_2_text_bottom') return 'col-1';
  if (layout === 'row_2_text_left' || layout === 'two_column_text_left') return 'col-2';
  if (layout === 'row_2_text_right' || layout === 'two_column_text_right') return 'col-1';
  return '';
}

function getTextColumnClass(layout: string) {
  return [getContentPlacementClass(layout), 'grid-col'].filter(Boolean).join(' ');
}

function getSupportingColumnClass(layout: string, supportingKind: string) {
  const placementClass = getSupportingPlacementClass(layout);
  const mediaClass = placementClass && supportingKind
    ? `${placementClass}-${supportingKind === 'image' ? 'img' : supportingKind === 'video' ? 'vid' : supportingKind}`
    : '';

  if (mediaClass) return mediaClass;
  return [placementClass, 'grid-col'].filter(Boolean).join(' ');
}

function isCanonicalContentLayout(layout: string) {
  return (
    layout === 'block' ||
    layout === 'stack_2_text_top' ||
    layout === 'stack_2_text_bottom' ||
    layout === 'row_2_text_left' ||
    layout === 'row_2_text_right'
  );
}

function supportsCanonicalFlexibleRendering(sectionType: string) {
  return sectionType === 'flexible_section' || sectionType === 'flexible_hero_section' || sectionType === 'flexible_cta_section' || sectionType === 'flexible_form_section';
}

function getContextImage(context?: TemplatePageRenderContext) {
  return (
    context?.service?.featured_image_url ||
    context?.area?.featured_image_url ||
    context?.blogPost?.featured_image_url ||
    ''
  );
}

function getContextIcon(context?: TemplatePageRenderContext) {
  return getString(context?.service?.icon).trim() || getString(context?.area?.icon).trim();
}

function getDefaultEntityIcon(context: TemplatePageRenderContext | undefined, kind: 'service' | 'area') {
  const businessDefault = kind === 'service'
    ? getSettingsString(context?.business?.settings, 'service_default_icon')
    : getSettingsString(context?.business?.settings, 'area_default_icon');

  if (businessDefault) return businessDefault;
  return kind === 'service' ? 'hammer' : 'pin';
}

function renderCtas(data: Record<string, unknown>, context?: TemplatePageRenderContext) {
  const hasPrimaryButton = getBoolean(data.primaryButton);
  const hasSecondaryButton = getBoolean(data.secondaryButton);
  if (!hasPrimaryButton && !hasSecondaryButton) return null;

  const primaryHref = context?.ctaDefaults?.primaryHref || '/contact';
  const secondaryHref = context?.ctaDefaults?.secondaryHref || '/services';
  const primaryLabel = context?.ctaDefaults?.primaryLabel || 'Get a Quote';
  const secondaryLabel = context?.ctaDefaults?.secondaryLabel || 'Our Services';

  return (
    <div className="btn-group">
      {hasPrimaryButton ? <a href={primaryHref} className="primary-btn">{primaryLabel}</a> : null}
      {hasSecondaryButton ? <a href={secondaryHref} className="secondary-btn">{secondaryLabel}</a> : null}
    </div>
  );
}

function renderTextContent(
  data: Record<string, unknown>,
  context: TemplatePageRenderContext | undefined,
  BlockRenderer: ComponentType<any>,
  headingAs: 'h1' | 'h2' = 'h2',
) {
  const accent = interpolate(getString(data.accent), context).trim();
  const heading = interpolate(getString(data.heading), context).trim();
  const lede = interpolate(getString(data.lede), context).trim();
  const HeadingTag = headingAs;
  const contentBlocks = Array.isArray(data.contentBlocks)
    ? data.contentBlocks.filter(
        (item): item is { type: string; data: Record<string, unknown> } =>
          !!item &&
          typeof item === 'object' &&
          !Array.isArray(item) &&
          typeof (item as { type?: unknown }).type === 'string' &&
          !!(item as { data?: unknown }).data &&
          typeof (item as { data?: unknown }).data === 'object' &&
          !Array.isArray((item as { data?: unknown }).data),
      )
    : [];

  return (
    <>
      {heading ? <HeadingTag>{heading}</HeadingTag> : null}
      {accent ? <p className="accent">{accent}</p> : null}
      {lede ? <p className="lede">{lede}</p> : null}
      {contentBlocks.length > 0 ? <BlockRenderer blocks={contentBlocks} /> : null}
      {renderCtas(data, context)}
    </>
  );
}

async function renderSupportingContent(
  data: Record<string, unknown>,
  layout: string,
  context: TemplatePageRenderContext | undefined,
  adapter: TemplatePageRendererAdapter,
) {
  const { AppImage, IconValue, FrontendForm } = adapter.components;
  const useContextFeaturedImage = getBoolean(data.useContextFeaturedImage);
  const supportingImage = (useContextFeaturedImage ? getContextImage(context) : '') || getString(data.supportingImage).trim();
  const supportingVideoUrl = getString(data.supportingVideoUrl).trim();
  const supportingFormId = getString(data.supportingFormId).trim();
  const iconValue = getBoolean(data.useContextIcon) ? getContextIcon(context) : getString(data.iconValue).trim();
  const supportingParagraph = interpolate(getString(data.supportingParagraph).trim(), context).trim();
  const supportingKind = getString(data.supportingKind).trim() || 'none';
  const supportingClassName = getSupportingColumnClass(layout, supportingKind);

  if (supportingKind === 'form' && supportingFormId) {
    const selectedForm = await adapter.getActiveFormById(supportingFormId);
    const fields = toFrontendFormFields(selectedForm?.fields);
    if (context?.contact?.businessId && selectedForm?.id && fields.length > 0) {
      return (
        <div className={[supportingClassName, 'form-wrap'].filter(Boolean).join(' ')}>
          <FrontendForm
            businessId={context.contact.businessId}
            formType="contact"
            services={(context.contact.services ?? []).map((service) => ({ id: service.id, title: service.title }))}
            fields={fields}
            formId={selectedForm.id}
            submitLabel="Send Message"
            successTitle="Thank you!"
            successMessage="We'll be in touch shortly."
            className="form"
          />
        </div>
      );
    }
  }

  if (supportingKind === 'image' && supportingImage) {
    const imageSizes =
      layout === 'stack'
        ? '(max-width: 575px) calc(100vw - 2rem), (max-width: 991px) min(92vw, 860px), min(82vw, 1200px)'
        : '(max-width: 575px) calc(100vw - 2rem), (max-width: 991px) calc(50vw - 1.5rem), calc(42vw - 2rem)';

    return (
      <div className={[supportingClassName].filter(Boolean).join(' ')}>
        <div className="img">
          <AppImage
            role="content"
            src={supportingImage}
            alt=""
            width={1400}
            height={1050}
            priority
            fetchPriority="high"
            loading="eager"
            sizes={imageSizes}
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </div>
      </div>
    );
  }

  if (supportingKind === 'video' && supportingVideoUrl) {
    const isEmbedUrl =
      supportingVideoUrl.includes('youtube.com') ||
      supportingVideoUrl.includes('youtu.be') ||
      supportingVideoUrl.includes('vimeo.com');

    return (
      <div className={[supportingClassName, 'vid'].filter(Boolean).join(' ')}>
        {isEmbedUrl ? (
          <iframe
            src={supportingVideoUrl}
            title="Section video"
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <video controls playsInline preload="metadata" src={supportingVideoUrl} />
        )}
      </div>
    );
  }

  if (supportingKind === 'icon' && iconValue) {
    return (
      <div className={[supportingClassName].filter(Boolean).join(' ')}>
        <div className="icon">
          <IconValue value={iconValue} />
        </div>
      </div>
    );
  }

  if (supportingKind === 'paragraph' && supportingParagraph) {
    return (
      <div className={[supportingClassName].filter(Boolean).join(' ')}>
        <p>{supportingParagraph}</p>
      </div>
    );
  }

  return null;
}

function renderBackgroundMedia(data: Record<string, unknown>, context?: TemplatePageRenderContext, AppImage?: ComponentType<any>) {
  const backgroundImageUrl = getString(data.backgroundImageUrl).trim() || (getBoolean(data.hasBackgroundImage) && getBoolean(data.useContextFeaturedImage) ? getContextImage(context) : '');
  const backgroundVideoUrl = getString(data.backgroundVideoUrl).trim();

  return (
    <>
      {getBoolean(data.hasBackgroundImage) && backgroundImageUrl && AppImage ? (
        <div className="img-bg" aria-hidden="true">
          <AppImage role="hero" src={backgroundImageUrl} alt="" fill style={{ objectFit: 'cover' }} />
        </div>
      ) : null}
      {getBoolean(data.hasBackgroundVideo) && backgroundVideoUrl ? (
        <div className="video-bg" aria-hidden="true">
          <video autoPlay muted loop playsInline preload="metadata" src={backgroundVideoUrl} />
        </div>
      ) : null}
    </>
  );
}

async function renderFlexibleSection(
  section: TemplateSectionInstance,
  context: TemplatePageRenderContext | undefined,
  adapter: TemplatePageRendererAdapter,
  isFirstSection = false,
  toneIndex = 0,
) {
  const data = section.data as Record<string, unknown>;
  const layout = section.type === 'flexible_section'
    ? normalizeCanonicalContentLayout(getString(data.layout))
    : (getString(data.layout).trim() || 'stack');
  const sectionClasses = getSectionClasses(data, toneIndex);
  const supporting = await renderSupportingContent(data, layout, context, adapter);
  const { AppImage, BlockRenderer } = adapter.components;
  const headingAs = isFirstSection ? 'h1' : 'h2';
  const usesContentLayout = section.type === 'flexible_section' && isCanonicalContentLayout(layout);

  if (usesContentLayout) {
    const hasSupporting = Boolean(supporting);
    const containerClasses = hasSupporting ? getContainerClasses(data, layout) : [
      'container',
      getBoolean(data.isCentered) ? 'content-center' : '',
    ].filter(Boolean).join(' ');

    return (
      <section className={sectionClasses}>
        {renderBackgroundMedia(data, context, AppImage)}
        <div className={containerClasses}>
          {hasSupporting ? (
            <>
              <div className="grid-col">
                {renderTextContent(data, context, BlockRenderer, headingAs)}
              </div>
              {supporting}
            </>
          ) : (
            renderTextContent(data, context, BlockRenderer, headingAs)
          )}
        </div>
      </section>
    );
  }

  const containerClasses = getContainerClasses(data, layout);

  if (layout === 'stack') {
    return (
      <section className={sectionClasses}>
        {renderBackgroundMedia(data, context, AppImage)}
        <div className={containerClasses}>
          {renderTextContent(data, context, BlockRenderer, headingAs)}
        </div>
        {supporting ? <div className="container">{supporting}</div> : null}
      </section>
    );
  }

  const textContent = (
    <div className={getTextColumnClass(layout)}>
      {renderTextContent(data, context, BlockRenderer, headingAs)}
    </div>
  );

  return (
    <section className={sectionClasses}>
      {renderBackgroundMedia(data, context, AppImage)}
      <div className={containerClasses}>
        {layout === 'two_column_text_right' ? supporting : textContent}
        {layout === 'two_column_text_right' ? textContent : supporting}
      </div>
    </section>
  );
}

function renderLockedSectionIntro(
  data: Record<string, unknown>,
  context?: TemplatePageRenderContext,
  headingAs: 'h1' | 'h2' = 'h2',
) {
  const accent = interpolate(getString(data.accent), context).trim();
  const heading = interpolate(getString(data.heading), context).trim();
  const lede = interpolate(getString(data.lede), context).trim();
  const HeadingTag = headingAs;

  if (!accent && !heading && !lede) return null;

  return (
    <div className="grid-col">
      {heading ? <HeadingTag>{heading}</HeadingTag> : null}
      {accent ? <p className="accent">{accent}</p> : null}
      {lede ? <p className="lede">{lede}</p> : null}
    </div>
  );
}

function renderSimpleCards(
  items: Array<{ title: string; body?: string; href?: string; imageSrc?: string; iconValue?: string }>,
  adapter?: Pick<TemplatePageRendererAdapter['components'], 'AppImage' | 'IconValue'>,
) {
  return (
    <>
      {items.map((item, index) => (
        item.href ? (
          <div key={`${item.title}-${index}`} className="card">
            {item.imageSrc && adapter?.AppImage ? (
              <div className="card-img">
                <adapter.AppImage role="card" src={item.imageSrc} alt="" width={1200} height={900} />
              </div>
            ) : null}
            {item.iconValue && adapter?.IconValue ? (
              <div className="card-icon">
                <adapter.IconValue value={item.iconValue} />
              </div>
            ) : null}
            <h3>{item.title}</h3>
            {item.body ? <p>{item.body}</p> : null}
            <a href={item.href} className="card-cta">
              Learn More
            </a>
          </div>
        ) : (
          <div key={`${item.title}-${index}`} className="card">
            {item.imageSrc && adapter?.AppImage ? (
              <div className="card-img">
                <adapter.AppImage role="card" src={item.imageSrc} alt="" width={1200} height={900} />
              </div>
            ) : null}
            {item.iconValue && adapter?.IconValue ? (
              <div className="card-icon">
                <adapter.IconValue value={item.iconValue} />
              </div>
            ) : null}
            <h3>{item.title}</h3>
            {item.body ? <p>{item.body}</p> : null}
          </div>
        )
      ))}
    </>
  );
}

async function renderLockedSection(
  section: TemplateSectionInstance,
  context: TemplatePageRenderContext | undefined,
  adapter: TemplatePageRendererAdapter,
  isFirstSection = false,
  toneIndex = 0,
) {
  const data = section.data as Record<string, unknown>;
  const sectionClasses = getSectionClasses(data, toneIndex);
  const { AppImage, IconValue } = adapter.components;
  const headingAs = isFirstSection ? 'h1' : 'h2';
  const rawHeading = getString(data.heading).trim();
  const sectionHeading = interpolate(rawHeading, context).trim();
  const sectionAccent = interpolate(getString(data.accent), context).trim();
  const sectionLede = interpolate(getString(data.lede), context).trim();
  const sectionSlotId = (section.slotId ?? '').trim();
  const allServices = context?.allServices ?? context?.services ?? [];
  const displayServices = context?.services ?? [];
  const allAreas = context?.serviceAreas ?? [];

  let body: ReactNode = null;

  if (section.type === 'service_grid_section') {
    const fallbackIcon = getDefaultEntityIcon(context, 'service');
    const isServicePage = Boolean(context?.service);
    const isUnifiedOtherServicesSlot = sectionSlotId === 'other_services' || sectionSlotId === 'related_services';
    const shouldUseDefaultOtherServicesHeading =
      rawHeading === '' ||
      rawHeading === 'Related Services' ||
      rawHeading === 'Other Services' ||
      rawHeading === 'Other {{service}} Services' ||
      rawHeading === 'Other {{primary_service}} Services' ||
      rawHeading === 'Other {{parent_service}} Services';

    const getSameCategoryServices = () => {
      const currentService = context?.service ?? null;
      if (!currentService) return [] as typeof allServices;

      if (currentService.parent_service_id) {
        const siblings = allServices.filter(
          (service) =>
            service.id !== currentService.id &&
            service.parent_service_id === currentService.parent_service_id,
        );
        const parent = context?.parentService ? [context.parentService] : [];
        return [...siblings, ...parent];
      }

      return (context?.childServices ?? []).filter((service) => service.id !== currentService.id);
    };

    const getOtherCategoryServices = () => {
      const currentService = context?.service ?? null;
      if (!currentService) return [] as typeof allServices;

      const currentCategoryId = currentService.parent_service_id ?? currentService.id;
      return allServices.filter((service) => {
        if (service.id === currentService.id) return false;
        const serviceCategoryId = service.parent_service_id ?? service.id;
        return serviceCategoryId !== currentCategoryId;
      });
    };

    const familyServices = getSameCategoryServices();
    const hasServiceFamilyContext = familyServices.length > 0;
    let services = [] as typeof allServices;
    let resolvedHeading = sectionHeading;

    if (isServicePage && context?.service) {
      if (isUnifiedOtherServicesSlot) {
        services = hasServiceFamilyContext ? familyServices : getOtherCategoryServices();
        if (shouldUseDefaultOtherServicesHeading) {
          resolvedHeading = hasServiceFamilyContext
            ? interpolate('Other {{parent_service}} Services', context).trim()
            : 'Other Services';
        }
      } else {
        services = familyServices;
        if (services.length === 0) services = getOtherCategoryServices();
      }

      if (services.length === 0) {
        services = allServices.filter((service) => service.id !== context.service?.id);
      }
    } else {
      services = displayServices;
    }

    services = services.filter((service) => service.title?.trim());
    if (services.length === 0) return null;
    body = renderSimpleCards(services.map((service) => ({
      title: service.title ?? 'Service',
      body: service.excerpt ?? '',
      href: service.slug ? buildServicePath(service.slug, context?.business?.settings) : undefined,
      imageSrc: service.featured_image_url ?? undefined,
      iconValue: getString(service.icon).trim() || fallbackIcon || undefined,
    })), { AppImage, IconValue });
    const HeadingTag = headingAs;
    return (
      <section className={sectionClasses}>
        {renderBackgroundMedia(data, context, AppImage)}
        <div className="container grid-1">
          {resolvedHeading || sectionAccent || sectionLede ? (
            <div className="grid-col">
              {resolvedHeading ? <HeadingTag>{resolvedHeading}</HeadingTag> : null}
              {sectionAccent ? <p className="accent">{sectionAccent}</p> : null}
              {sectionLede ? <p className="lede">{sectionLede}</p> : null}
            </div>
          ) : null}
          <div className="auto-grid grid-col">{body}</div>
        </div>
      </section>
    );
  } else if (section.type === 'area_grid_section') {
    const fallbackIcon = getDefaultEntityIcon(context, 'area');
    const isHomePage = (context?.url ?? '').trim() === '/';
    const isServicePage = Boolean(context?.service) && !context?.area;
    const isAreaPage = Boolean(context?.area);
    const currentServiceTitle = (context?.service?.title ?? '').trim();
    const parentServiceTitle = (context?.parentService?.title ?? '').trim();
    const currentServiceAreaHeading = currentServiceTitle ? `Our ${currentServiceTitle} Service Area` : '';
    const parentServiceAreaHeading = parentServiceTitle ? `Our ${parentServiceTitle} Service Area` : '';
    const shouldUseDefaultServiceAreaHeading =
      rawHeading === '' ||
      rawHeading === 'All Areas' ||
      rawHeading === 'Areas We Serve' ||
      rawHeading === 'Areas We Provide' ||
      rawHeading === 'Areas We Provide {{service}}' ||
      rawHeading === 'Areas We Provide {{parent_service}}' ||
      rawHeading === 'Areas We Provide...' ||
      rawHeading === 'Our Service Area' ||
      rawHeading === 'Our {{service}} Service Area' ||
      rawHeading === currentServiceAreaHeading ||
      rawHeading === parentServiceAreaHeading ||
      sectionSlotId === 'related_areas';

    let areas = allAreas;
    let resolvedHeading = sectionHeading;

    if (isAreaPage && context?.area) {
      areas = allAreas.filter((area) => area.id !== context.area?.id);
    }

    if (isServicePage && shouldUseDefaultServiceAreaHeading) {
      resolvedHeading = interpolate('Our {{service}} Service Area', context).trim();
    }

    if ((isHomePage || isServicePage || isAreaPage) && areas.length > 0) {
      areas = [...areas];
    }

    areas = areas.filter((area) => area.name?.trim());
    if (areas.length === 0) return null;
    body = renderSimpleCards(areas.map((area) => ({
      title: area.name ?? 'Area',
      body: area.excerpt ?? '',
      href: area.slug ? buildAreaPath(area.slug, context?.business?.settings) : undefined,
      imageSrc: area.featured_image_url ?? undefined,
      iconValue: getString(area.icon).trim() || fallbackIcon || undefined,
    })), { AppImage, IconValue });
    const HeadingTag = headingAs;
    return (
      <section className={sectionClasses}>
        {renderBackgroundMedia(data, context, AppImage)}
        <div className="container grid-1">
          {resolvedHeading || sectionAccent || sectionLede ? (
            <div className="grid-col">
              {resolvedHeading ? <HeadingTag>{resolvedHeading}</HeadingTag> : null}
              {sectionAccent ? <p className="accent">{sectionAccent}</p> : null}
              {sectionLede ? <p className="lede">{sectionLede}</p> : null}
            </div>
          ) : null}
          <div className="auto-grid grid-col">{body}</div>
        </div>
      </section>
    );
  } else if (section.type === 'blog_grid_section') {
    const isBlogArchivePage = Boolean(context?.blogArchivePosts?.length || context?.blogArchivePagination);
    const posts = isBlogArchivePage
      ? context?.blogArchivePosts ?? []
      : (context?.relatedBlogPosts ?? []).filter((post) => post.id !== context?.blogPost?.id);
    if (posts.length === 0) return null;
    body = renderSimpleCards(posts.map((post) => ({
      title: post.title ?? 'Post',
      body: post.excerpt ?? '',
      href: undefined,
      imageSrc: post.featured_image_url ?? undefined,
    })), { AppImage, IconValue });
  } else if (section.type === 'team_grid_section') {
    const members = (context?.teamMembers ?? []).filter((member) => member.title?.trim());
    if (members.length === 0) return null;
    body = renderSimpleCards(members.map((member) => ({
      title: member.title ?? 'Team Member',
    })), { AppImage, IconValue });
  } else if (section.type === 'gallery_section') {
    const images = context?.galleryImages ?? [];
    if (images.length === 0) return null;
    body = (
      <>
        {images.map((image) => (
          <div key={image.id} className="img">
            <AppImage role="gallery" src={image.file_url} alt={image.caption ?? ''} width={1200} height={900} />
          </div>
        ))}
      </>
    );
  } else if (section.type === 'before_after_section') {
    const groups = context?.beforeAfterGroups ?? [];
    const images = context?.galleryImages ?? [];
    if (groups.length === 0) return null;
    if (images.length === 0) return null;
    body = (
      <>
        {images.map((image) => (
          <div key={image.id} className="img">
            <AppImage role="gallery" src={image.file_url} alt={image.caption ?? ''} width={1200} height={900} />
          </div>
        ))}
      </>
    );
  } else if (section.type === 'projects_section') {
    if ((context?.projects ?? []).length === 0) return null;
    body = renderSimpleCards((context?.projects ?? []).map((project) => ({
      title: project.title ?? 'Project',
      body: project.summary ?? '',
      imageSrc: Array.isArray(project.photo_urls) ? project.photo_urls[0] : undefined,
    })), { AppImage, IconValue });
  } else if (section.type === 'faq_section') {
    const faqs = await getPublicFaqs({
      global: !context?.service,
      serviceId: context?.service?.id,
    });
    if (faqs.length === 0) return null;
    body = (
      <>
        {faqs.map((faq) => (
          <div key={faq.id} className="card">
            <h3>{faq.question ?? 'Question'}</h3>
            <p>{faq.answer ?? ''}</p>
          </div>
        ))}
      </>
    );
  } else if (section.type === 'testimonial_section') {
    if ((context?.testimonials ?? []).length === 0) return null;
    body = (
      <>
        {(context?.testimonials ?? []).map((testimonial) => (
          <div key={testimonial.id} className="card">
            <p>{testimonial.content ?? ''}</p>
            {testimonial.customer_name ? <p>{testimonial.customer_name}</p> : null}
          </div>
        ))}
      </>
    );
  } else if (section.type === 'process_section') {
    const pageKind =
      context?.service ? 'service'
        : context?.area ? 'serviceArea'
        : context?.page?.title?.toLowerCase().includes('about') ? 'about'
        : 'home';
    const steps = adapter.getDefaultProcessSteps(pageKind);
    const normalizedSteps = Array.isArray(steps) ? steps : [];
    body = (
      <>
        {normalizedSteps.map((step, index) => {
          const row = step && typeof step === 'object' && !Array.isArray(step) ? (step as Record<string, unknown>) : {};
          return (
            <div key={`step-${index}`} className="card">
              <h3>{getString(row.title).trim() || `Step ${index + 1}`}</h3>
              {getString(row.description).trim() ? <p>{getString(row.description).trim()}</p> : null}
            </div>
          );
        })}
      </>
    );
  }

  return (
    <section className={sectionClasses}>
      {renderBackgroundMedia(data, context, AppImage)}
      <div className="container grid-1">
        {renderLockedSectionIntro(data, context, headingAs)}
        {body ? <div className="auto-grid grid-col">{body}</div> : null}
      </div>
    </section>
  );
}

export async function renderCanonicalSection({
  section,
  context,
  adapter,
  isFirstSection = false,
  toneIndex = 0,
}: CanonicalSectionRendererProps) {
  if (supportsCanonicalFlexibleRendering(section.type)) {
    return renderFlexibleSection(section, context, adapter, isFirstSection, toneIndex);
  }

  if (isCanonicalLockedSectionType(section.type) || usesCanonicalSectionSystem(section.type)) {
    return renderLockedSection(section, context, adapter, isFirstSection, toneIndex);
  }

  return null;
}
