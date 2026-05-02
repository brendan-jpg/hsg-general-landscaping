import Link from 'next/link';
import type { TemplateSectionInstance } from '../templatePages';
import {
  getObject,
  getString,
  interpolateDynamicTags,
  toFrontendFormFields,
  type TemplatePageRenderContext,
  type TemplatePageRendererAdapter,
  type Service,
} from './shared';

async function RenderedSection({
  section,
  context,
  adapter,
  isFirstSection = false,
}: {
  section: TemplateSectionInstance;
  context?: TemplatePageRenderContext;
  adapter: TemplatePageRendererAdapter;
  isFirstSection?: boolean;
}) {
  const GRID_CONDENSE_THRESHOLD = 8;
  const HOME_TEAM_GRID_LIMIT = 4;
  if (section.hidden) return null;

  const data = section.data as Record<string, unknown>;
  const getList = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
  const resolveText = (value: unknown) => interpolateDynamicTags(getString(value), context);
  const rawHeading = getString(data.heading).trim();
  const headingAs = isFirstSection ? 'h1' : 'h2';
  const SectionHeadingTag = headingAs;
  const sectionSlotId = (section.slotId ?? '').trim();
  const isHomePage = (context?.url ?? '').trim() === '/';
  const sectionAccent = resolveText(data.accent).trim();
  const sectionHeading = resolveText(data.heading).trim();
  const sectionLede = resolveText(data.lede).trim();
  const sectionImage = getString(data.image).trim();
  const defaultPrimaryCtaLabel = resolveText(context?.ctaDefaults?.primaryLabel).trim() || 'Get a Quote';
  const defaultPrimaryCtaHref = getString(context?.ctaDefaults?.primaryHref).trim() || '/contact';
  const defaultSecondaryCtaLabel = resolveText(context?.ctaDefaults?.secondaryLabel).trim() || 'Our Services';
  const defaultSecondaryCtaHref = getString(context?.ctaDefaults?.secondaryHref).trim() || '/services';
  const sectionProcessSteps = getList(data.steps)
    .map((step) => {
      const item = getObject(step);
      return {
        heading: resolveText(item.heading).trim(),
        lede: resolveText(item.lede).trim(),
      };
    })
    .filter((step) => step.heading.length > 0 || step.lede.length > 0);
  const hasQuoteField = Object.prototype.hasOwnProperty.call(data, 'quote');
  const hasAttributionField = Object.prototype.hasOwnProperty.call(data, 'attribution');
  const serviceNameById = Object.fromEntries(
    (context?.services ?? []).map((service) => [service.id, service.title ?? 'Service']),
  ) as Record<string, string>;
  const areaNameById = Object.fromEntries(
    (context?.serviceAreas ?? []).map((area) => [area.id, area.name ?? 'Area']),
  ) as Record<string, string>;
  const {
    AppImage,
    MarkdownLite,
    BlockRenderer,
    PrimaryButton,
    Hero,
    ServiceGridSection,
    TestimonialSection,
    FaqSection,
    ProjectsSection,
    FrontendForm,
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
  } = adapter.components;

  const pageHeroClassByType: Partial<Record<TemplateSectionInstance['type'], string>> = {
    about_hero_section: 'about__hero about-hero-section',
    contact_hero_section: 'contact__hero contact-hero-section',
    service_archive_hero_section: 'services-archive__hero services-archive-hero-section',
    service_area_archive_hero_section: 'areas-archive__hero areas-archive-hero-section',
    blog_archive_hero_section: 'blog-archive__hero blog-archive-hero-section',
  };

  const allServices = context?.allServices ?? context?.services ?? [];
  const displayServices = context?.services ?? [];
  const allAreas = context?.serviceAreas ?? [];
  const allTeamMembers = context?.teamMembers ?? [];
  const pageContext =
    context?.service ? 'service'
      : context?.area ? 'area'
      : (context?.url ?? '').trim() === '/' ? 'home'
      : (context?.url ?? '').includes('/about') ? 'about'
      : (context?.url ?? '').includes('/contact') ? 'contact'
      : (context?.url ?? '').includes('/blog') ? 'blog'
      : (context?.url ?? '').includes('/service-areas') ? 'archive'
      : (context?.url ?? '').includes('/services') ? 'archive'
      : 'page';

  function getSameCategoryServices() {
    const currentService = context?.service ?? null;
    if (!currentService) return [] as Service[];

    if (currentService.parent_service_id) {
      const siblings = allServices.filter(
        (service) => service.id !== currentService.id && service.parent_service_id === currentService.parent_service_id,
      );
      const parent = context?.parentService ? [context.parentService] : [];
      return [...siblings, ...parent];
    }

    return (context?.childServices ?? []).filter((service) => service.id !== currentService.id);
  }

  function getOtherCategoryServices() {
    const currentService = context?.service ?? null;
    if (!currentService) return [];

    const currentCategoryId = currentService.parent_service_id ?? currentService.id;
    return allServices.filter((service) => {
      if (service.id === currentService.id) return false;
      const serviceCategoryId = service.parent_service_id ?? service.id;
      return serviceCategoryId !== currentCategoryId;
    });
  }

  function getFamilyServices() {
    return getSameCategoryServices();
  }

  function getFlexMediaPlacementClass(layout: string, mediaKind: 'form' | 'img' | 'vid') {
    if (layout === 'one_column') return '';
    const slot = layout === 'two_column_text_right' ? 'col-1' : 'col-2';
    return `${slot}-${mediaKind}`;
  }

  async function renderLegacyContactFormSection() {
    const contact = context?.contact;
    if (!contact) return null;
    const sectionFormId = getString(data.contact_form_id).trim();
    const unavailableText = resolveText(data.unavailableText).trim();
    const selectedForm = sectionFormId ? await adapter.getActiveFormById(sectionFormId) : null;
    const selectedFields = toFrontendFormFields(selectedForm?.fields);
    const contactBgImage = await adapter.getPrimaryServiceGalleryImages(6);
    const contactImagePool = contactBgImage
      .map((item) => (typeof item.file_url === 'string' ? item.file_url.trim() : ''))
      .filter((url): url is string => url.length > 0);
    const contactImageSources = contactImagePool;
    const contactMosaicUrls = Array.from({ length: 6 }, (_, index) => contactImageSources[index % contactImageSources.length]);

    return (
      <section className="contact-form-section cta-section cta-section--feature">
        <div className="contact__layout cta-banner cta-banner--feature container">
          <div className="cta-banner__backdrop contact__backdrop" aria-hidden="true">
            {contactMosaicUrls.length > 0 ? (
              <div className="cta-banner__backdrop-mosaic">
                {contactMosaicUrls.map((url, index) => (
                  <div
                    key={`contact-backdrop-mosaic-${url}-${index}`}
                    className={`cta-banner__backdrop-tile cta-banner__backdrop-tile--${index + 1}`}
                  >
                    <AppImage role="gallery" src={url} alt="" width={900} height={675} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="cta-banner__image-fallback" />
            )}
          </div>
          <div className="cta-banner__inner contact__inner">
            <div className="contact__hero-col cta-banner__copy">
              {sectionHeading ? <SectionHeadingTag className="contact__title">{sectionHeading}</SectionHeadingTag> : null}
              {sectionAccent ? <p className="home-intro-feature__accent">{sectionAccent}</p> : null}
              {sectionLede ? <p className="hero__subtitle">{sectionLede}</p> : null}
              <div className="contact__brand">
                {contact.business?.logo_url ? (
                  <span className="header__logo contact__brand-logo">
                    <span className="header__logo-mark">
                      <AppImage
                        role="logo"
                        src={contact.business.logo_url}
                        alt={contact.business?.name ? `${contact.business.name} logo` : ''}
                        fill
                        sizes="(max-width: 768px) 220px, 320px"
                        style={{ objectFit: 'contain' }}
                      />
                    </span>
                  </span>
                ) : contact.business?.name ? (
                  <span>{contact.business.name}</span>
                ) : null}
              </div>
            </div>
            <div className="contact__form-col">
              {contact.businessId && selectedForm?.id && selectedFields.length > 0 ? (
                <FrontendForm
                  businessId={contact.businessId}
                  formType="contact"
                  services={contact.services.map((service) => ({ id: service.id, title: service.title }))}
                  fields={selectedFields}
                  formId={selectedForm.id}
                  submitLabel="Send Message"
                  successTitle="Thank you!"
                  successMessage="We'll be in touch shortly."
                  className="contact-form"
                />
              ) : (
                unavailableText ? <p>{unavailableText}</p> : null
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  switch (section.type) {
    case 'service_archive_hero_section':
    case 'service_area_archive_hero_section':
    case 'blog_archive_hero_section':
    case 'contact_hero_section':
    case 'about_hero_section': {
      const layout = getString(data.layout).trim() || getString(data.variant).trim() || 'default';
      const variant = ['boxed', 'minimal', 'contrast'].includes(getString(data.variant).trim())
        ? getString(data.variant).trim()
        : 'default';
      return (
        <PageHero
          variant={layout}
          accent={sectionAccent || undefined}
          heading={sectionHeading}
          lede={sectionLede || undefined}
          className={`${pageHeroClassByType[section.type] ?? 'page__hero'} ${section.type}--${layout} ${section.type}--variant-${variant}`}
        />
      );
    }

    case 'home_hero_section':
      {
      const layout = resolveText(data.layout).trim() || resolveText(data.variant).trim() || 'default';
      const variant = ['boxed', 'minimal', 'contrast'].includes(resolveText(data.variant).trim())
        ? resolveText(data.variant).trim()
        : 'default';
      return (
        <Hero
          heading={sectionHeading || undefined}
          lede={sectionLede || undefined}
          accent={resolveText(data.accent).trim() || undefined}
          variant={layout}
          primaryCtaHref={resolveText(data.primaryCtaHref).trim() || undefined}
          primaryCtaText={defaultPrimaryCtaLabel}
          secondaryCtaText={defaultSecondaryCtaLabel}
          secondaryCtaHref={defaultSecondaryCtaHref}
          className={`home-hero-section home-hero-section--${layout} home-hero-section--variant-${variant}`}
        />
      );
      }

    case 'testimonial_section': {
      const testimonials = context?.testimonials ?? [];
      if (testimonials.length === 0) return null;
      const currentServiceTitle = (context?.service?.title ?? '').trim();
      const parentServiceTitle = (context?.parentService?.title ?? '').trim();
      const currentServiceReviewsHeading = currentServiceTitle ? `${currentServiceTitle} Reviews` : '';
      const parentServiceReviewsHeading = parentServiceTitle ? `${parentServiceTitle} Reviews` : '';
      const shouldUseDefaultServiceReviewsHeading =
        rawHeading === '' ||
        rawHeading === 'Our Reviews' ||
        rawHeading === 'Reviews' ||
        rawHeading === '{{service}} Reviews' ||
        rawHeading === '{{parent_service}} Reviews' ||
        rawHeading === currentServiceReviewsHeading ||
        rawHeading === parentServiceReviewsHeading ||
        sectionSlotId === 'related_reviews';
      const resolvedTestimonialsHeading =
        context?.service && shouldUseDefaultServiceReviewsHeading
          ? context.hasFamilyTestimonials === false
            ? 'What Our Customers Say'
            : resolveText('{{parent_service}} Reviews').trim()
          : sectionHeading || '';
      return (
        <TestimonialSection
          testimonials={testimonials}
          heading={resolvedTestimonialsHeading}
          headingAs={headingAs}
          accent={sectionAccent || ''}
          lede={sectionLede || ''}
          className={context?.service || context?.area ? 'related-testimonials-section' : 'testimonials-section'}
          serviceNameById={serviceNameById}
          areaNameById={areaNameById}
          variant={context?.service || context?.area ? 'grid' : 'slider'}
        />
      );
    }

    case 'faq_section':
      if (context?.service) {
        const shouldUseDefaultRelatedFaqHeading =
          rawHeading === '' ||
          rawHeading === 'Related FAQs' ||
          rawHeading === 'FAQs';
        const resolvedHeading = shouldUseDefaultRelatedFaqHeading
          ? resolveText('Related {{parent_service}} FAQs').trim()
          : sectionHeading || '';

        return (
          <FaqSection
            heading={resolvedHeading}
            headingAs={headingAs}
            accent={sectionAccent || ''}
            lede={sectionLede || ''}
            className="faq-section"
            serviceId={context.service.id}
            fallbackServiceId={context.parentService?.id ?? undefined}
            fallbackNote={sectionLede || undefined}
          />
        );
      }

      return (
        <FaqSection
          global
          heading={sectionHeading || ''}
          headingAs={headingAs}
          accent={sectionAccent || ''}
          lede={sectionLede || ''}
          className="faq-section"
        />
      );

    case 'projects_section': {
      const projects = context?.projects ?? [];
      if (projects.length === 0) return null;
      return (
        <ProjectsSection
          areaName={context?.area?.name ?? ''}
          projects={projects}
          heading={sectionHeading || ''}
          headingAs={headingAs}
          accent={sectionAccent || ''}
          lede={sectionLede || ''}
          className={(context?.area ? 'area-projects-section' : 'projects-section')}
        />
      );
    }

    case 'profile_card_featured_section': {
      const teamMembers = context?.teamMembers ?? [];
      const featuredProfile = teamMembers[0] ?? null;
      const heading = sectionHeading;
      const lede = sectionLede || undefined;
      return (
        <OwnerSpotlightSection
          member={featuredProfile}
          heading={heading}
          headingAs={headingAs}
          lede={lede}
          accent={resolveText(data.profileAccent).trim() || undefined}
          fallbackBio={resolveText(data.profileBody).trim() || undefined}
          primaryCtaText={defaultPrimaryCtaLabel}
          primaryCtaHref={defaultPrimaryCtaHref}
          className="profile-section"
        />
      );
    }

    case 'callout_quote_featured_section': {
      const testimonials = context?.testimonials ?? [];
      const business = context?.business ?? null;
      const isHomePage = (context?.url ?? '').trim() === '/';
      const heading = sectionHeading || '';
      const quote = hasQuoteField ? resolveText(data.quote).trim() : (testimonials[0]?.content?.trim() || '');
      const attribution =
        (hasAttributionField ? resolveText(data.attribution).trim() : '') ||
        (testimonials[0]?.customer_name?.trim()
          ? [testimonials[0].customer_name, testimonials[0].area_id ? areaNameById[testimonials[0].area_id] : ''].filter(Boolean).join(' | ')
          : (business?.name?.trim() || ''));
      const heroSlides = isHomePage ? await adapter.getPrimaryServiceGalleryImages(4) : [];
      return (
        <CalloutQuoteSection
          heading={heading}
          headingAs={headingAs}
          quote={quote}
          attribution={attribution}
          hideTitle={isHomePage}
          heroSlides={heroSlides}
          className="callout-quote-section"
        />
      );
    }

    case 'team_grid_section': {
      const isHomePage = (context?.url ?? '').trim() === '/';
      const members = isHomePage ? allTeamMembers.slice(0, HOME_TEAM_GRID_LIMIT) : allTeamMembers;
      if (members.length === 0) return null;
      return (
        <TeamGridSection
          members={members}
          heading={sectionHeading || ''}
          headingAs={headingAs}
          accent={sectionAccent || ''}
          lede={sectionLede || ''}
          className="team-section"
          variant={isHomePage ? 'condensed' : 'default'}
          viewAllHref="/about"
        />
      );
    }

    case 'service_grid_section': {
      const isHomePage = (context?.url ?? '').trim() === '/';
      const isServiceArchivePage = (context?.url ?? '').trim() === '/services';
      const isAreaPage = Boolean(context?.area) && !context?.service;
      const isServicePage = Boolean(context?.service);
      const serviceGridSlotId = (section.slotId ?? '').trim();
      const isUnifiedOtherServicesSlot = serviceGridSlotId === 'other_services' || serviceGridSlotId === 'related_services';
      const isRelatedServicesGrid = serviceGridSlotId === 'related_services';
      const familyServices = getFamilyServices();
      const hasServiceFamilyContext = familyServices.length > 0;
      const shouldUseDefaultOtherServicesHeading =
        rawHeading === '' ||
        rawHeading === 'Related Services' ||
        rawHeading === 'Other Services' ||
        rawHeading === 'Other {{service}} Services' ||
        rawHeading === 'Other {{primary_service}} Services' ||
        rawHeading === 'Other {{parent_service}} Services';
      let services: Service[] = [];
      let variant: 'default' | 'condensed' = 'default';
      let resolvedHeading = sectionHeading;

      if (isServicePage && context?.service) {
        if (isUnifiedOtherServicesSlot) {
          services = hasServiceFamilyContext ? familyServices : getOtherCategoryServices();
          if (shouldUseDefaultOtherServicesHeading) {
            resolvedHeading = hasServiceFamilyContext
              ? resolveText('Other {{parent_service}} Services').trim()
              : 'Other Services';
          }
        } else if (serviceGridSlotId === 'related_services') {
          services = getOtherCategoryServices();
          if (services.length === 0) services = familyServices;
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

      const shouldCondenseServiceGrid =
        !isServiceArchivePage &&
        !isRelatedServicesGrid &&
        (
          services.length > GRID_CONDENSE_THRESHOLD ||
          (isHomePage && allServices.length > GRID_CONDENSE_THRESHOLD)
        );

      if (shouldCondenseServiceGrid) {
        variant = 'condensed';
      }

      if (services.length === 0) return null;
      return (
        <ServiceGridSection
          services={services}
          heading={resolvedHeading}
          headingAs={headingAs}
          accent={sectionAccent}
          lede={sectionLede}
          className="service-grid-section"
          variant={variant}
          viewAllHref={isServiceArchivePage ? undefined : "/services"}
        />
      );
    }

    case 'area_grid_section': {
      const isHomePage = (context?.url ?? '').trim() === '/';
      const isServicePage = Boolean(context?.service) && !context?.area;
      const isAreaPage = Boolean(context?.area);
      let areas = allAreas;
      let variant: 'default' | 'condensed' = 'default';
      let resolvedHeading = sectionHeading;

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

      if (isAreaPage && context?.area) {
        areas = allAreas.filter((area) => area.id !== context.area?.id);
        if (areas.length > GRID_CONDENSE_THRESHOLD) variant = 'condensed';
      } else if ((isHomePage || isServicePage) && areas.length > GRID_CONDENSE_THRESHOLD) {
        variant = 'condensed';
      }

      if (isServicePage && shouldUseDefaultServiceAreaHeading) {
        resolvedHeading = resolveText('Our {{service}} Service Area').trim();
      }

      if (areas.length === 0) return null;
      return (
        <AreaGridSection
          areas={areas}
          heading={resolvedHeading}
          headingAs={headingAs}
          accent={sectionAccent || ''}
          lede={sectionLede || ''}
          className="area-grid-section"
          variant={variant}
          viewAllHref="/service-areas"
        />
      );
    }

    case 'blog_grid_section': {
      const isBlogArchivePage = Boolean(context?.blogArchivePosts?.length || context?.blogArchivePagination);
      const posts = isBlogArchivePage
        ? context?.blogArchivePosts ?? []
        : (context?.relatedBlogPosts ?? []).filter((post) => post.id !== context?.blogPost?.id);
      if (posts.length === 0) return null;
      return (
        <BlogGridSection
          posts={posts}
          heading={sectionHeading || ''}
          accent={sectionAccent || ''}
          lede={sectionLede || ''}
          className="blog-grid-section"
          variant={isBlogArchivePage ? 'default' : 'condensed'}
          viewAllHref={isBlogArchivePage ? undefined : '/blog'}
          currentPage={isBlogArchivePage ? context?.blogArchivePagination?.currentPage : undefined}
          totalPages={isBlogArchivePage ? context?.blogArchivePagination?.totalPages : undefined}
          basePath={isBlogArchivePage ? context?.blogArchivePagination?.basePath ?? '/blog' : undefined}
        />
      );
    }

    case 'contact_form_section': {
      return renderLegacyContactFormSection();
    }

    case 'process_home_section':
      return <ProcessSection heading={sectionHeading || ''} headingAs={headingAs} accent={sectionAccent || ''} lede={sectionLede || ''} steps={sectionProcessSteps.length > 0 ? sectionProcessSteps : adapter.getDefaultProcessSteps('home')} className="process-section process-home-section" />;
    case 'process_service_section':
      return <ProcessSection heading={sectionHeading || ''} headingAs={headingAs} accent={sectionAccent || ''} lede={sectionLede || ''} steps={sectionProcessSteps.length > 0 ? sectionProcessSteps : adapter.getDefaultProcessSteps('service')} className="process-section process-service-section" />;
    case 'process_service_area_section':
      return <ProcessSection heading={sectionHeading || ''} headingAs={headingAs} accent={sectionAccent || ''} lede={sectionLede || ''} steps={sectionProcessSteps.length > 0 ? sectionProcessSteps : adapter.getDefaultProcessSteps('serviceArea')} className="process-section process-area-section" />;
    case 'process_about_section':
      return <ProcessSection heading={sectionHeading || ''} headingAs={headingAs} accent={sectionAccent || ''} lede={sectionLede || ''} steps={sectionProcessSteps.length > 0 ? sectionProcessSteps : adapter.getDefaultProcessSteps('about')} className="process-section process-about-section" />;

    case 'service_hero_section': {
      const service = context?.service;
      if (!service) return null;
      const parentService = context?.parentService;
      const headingOverride = sectionHeading;
      const ledeOverride = sectionLede;
      const layout = getString(data.layout).trim() || getString(data.variant).trim() || 'default';
      const variant = ['boxed', 'minimal', 'contrast'].includes(getString(data.variant).trim())
        ? getString(data.variant).trim()
        : 'default';
      return (
        <ServicePageHero
          accent={sectionAccent || undefined}
          variant={layout}
          heading={headingOverride || service.title}
          lede={ledeOverride || service.excerpt}
          featuredImageUrl={service.featured_image_url}
          className={`service__hero service-hero-section service-hero-section--${layout} service-hero-section--variant-${variant}`}
          breadcrumb={
            parentService ? (
              <nav className="service__breadcrumb" aria-label="Breadcrumb">
                <Link href="/services">Services</Link>
                <span>/</span>
                <Link href={`/services/${parentService.slug}`}>{parentService.title}</Link>
              </nav>
            ) : undefined
          }
          icon={service.icon ? <IconValue value={service.icon} imageClassName="service__icon-image" /> : undefined}
        />
      );
    }

    case 'service_area_hero_section': {
      const area = context?.area;
      if (!area) return null;
      const headingOverride = sectionHeading;
      const ledeOverride = sectionLede;
      const layout = getString(data.layout).trim() || getString(data.variant).trim() || 'default';
      const variant = ['boxed', 'minimal', 'contrast'].includes(getString(data.variant).trim())
        ? getString(data.variant).trim()
        : 'default';
      return (
        <AreaPageHero
          variant={layout}
          heading={headingOverride || area.name}
          lede={ledeOverride || undefined}
          featuredImageUrl={area.featured_image_url}
          iconValue={area.icon}
          className={`area__hero area-hero-section area-hero-section--${layout} area-hero-section--variant-${variant}`}
        />
      );
    }

    case 'blog_hero_section': {
      const post = context?.blogPost;
      if (!post) return null;
      const headingOverride = sectionHeading;
      const ledeOverride = sectionLede;
      const layout = getString(data.layout).trim() || getString(data.variant).trim() || 'default';
      const variant = ['boxed', 'minimal', 'contrast'].includes(getString(data.variant).trim())
        ? getString(data.variant).trim()
        : 'default';
      const publishedLabel =
        context?.blogPublishedLabel ||
        (post.published_at ? new Date(post.published_at).toLocaleDateString() : new Date(post.created_at).toLocaleDateString());
      return (
        <BlogPageHero
          variant={layout}
          accent={sectionAccent || undefined}
          heading={headingOverride || post.title}
          lede={ledeOverride || post.excerpt}
          dateLabel={publishedLabel}
          readTimeMinutes={post.read_time_minutes}
          featuredImageUrl={post.featured_image_url}
          sectionClassName={`blog-post__hero blog-hero-section blog-hero-section--${layout} blog-hero-section--variant-${variant}`}
        />
      );
    }

    case 'gallery_section':
      if ((context?.galleryImages ?? []).length === 0) return null;
      return (
          <GallerySection
            images={context?.galleryImages ?? []}
            heading={sectionHeading || ''}
          headingAs={headingAs}
          accent={sectionAccent || ''}
          lede={sectionLede || ''}
          className={context?.service ? 'service-gallery-section' : 'gallery-section'}
        />
      );

    case 'logos_section': {
      const logos = getList(data.logos)
        .map((item) => {
          const logo = getObject(item);
          return {
            image: getString(logo.image).trim(),
            alt: resolveText(logo.alt).trim(),
            label: resolveText(logo.label).trim(),
            href: getString(logo.href).trim(),
          };
        })
        .filter((logo) => logo.image.length > 0);

      if (logos.length === 0) return null;

      return (
        <LogosSection
          logos={logos}
          heading={sectionHeading || ''}
          headingAs={headingAs}
          accent={sectionAccent || ''}
          lede={sectionLede || ''}
          className="logos-section"
        />
      );
    }

      case 'before_after_section': {
        const service = context?.service;
        const area = context?.area;
        if ((context?.beforeAfterGroups ?? []).length === 0) return null;
        const itemLabel = service?.title || (area ? `${area.name} project` : 'project');
        return (
          <BeforeAfterSection
          groups={context?.beforeAfterGroups ?? []}
          itemLabel={itemLabel}
          heading={sectionHeading || ''}
          headingAs={headingAs}
          accent={sectionAccent || ''}
          lede={sectionLede || ''}
          className="before-after-section"
        />
      );
    }

    case 'hero_standard': {
      const cta = getObject(data.primaryCta);
      const ctaHref = getString(cta.href).trim() || defaultPrimaryCtaHref;
      return (
        <section className="content-hero-section">
          <div className="container">
            {sectionHeading ? <SectionHeadingTag>{sectionHeading}</SectionHeadingTag> : null}
            {sectionAccent ? <p>{sectionAccent}</p> : null}
            {sectionLede ? <p>{sectionLede}</p> : null}
            {ctaHref && (
              <p>
                <PrimaryButton href={ctaHref}>{defaultPrimaryCtaLabel}</PrimaryButton>
              </p>
            )}
          </div>
        </section>
      );
    }

    case 'rich_text_section': {
      const variant = getString(data.variant).trim() || (isHomePage ? 'feature' : 'default');
      const fallbackHomeImage =
        'https://sepbhgqkowpmqzynormq.supabase.co/storage/v1/object/public/media/3cbb5d4b-a7f2-4030-a26b-7bab14cf0aaf/assets/1772042315714-2-4b0d5e35-edb2-43c2-9a79-433a83bbf0cd/DJI_0055-366f574d-1152w-1150w.webp';
      const imageUrl = sectionImage || (isHomePage ? fallbackHomeImage : '');
      const image = imageUrl ? (
        <AppImage
          role="content"
          src={imageUrl}
          alt={sectionHeading || rawHeading || ''}
          width={1150}
          height={1152}
        />
      ) : null;

      if (variant === 'feature') {
        return (
          <section className="home-intro-section text-content-section">
            <div className="home-intro-feature container">
              <div className="home-intro-feature__copy">
                {sectionHeading ? <SectionHeadingTag>{sectionHeading}</SectionHeadingTag> : null}
                {sectionAccent ? <p className="home-intro-feature__accent">{sectionAccent}</p> : null}
                {sectionLede ? (
                  <div className="home-intro-feature__lede">
                    <MarkdownLite content={sectionLede} />
                  </div>
                ) : null}
                {isHomePage ? (
                  <div className="home-intro-feature__actions">
                    <PrimaryButton href={defaultPrimaryCtaHref}>{defaultPrimaryCtaLabel}</PrimaryButton>
                  </div>
                ) : null}
              </div>
              {image ? (
                <div className="home-intro-feature__visual" aria-hidden="true">
                  <div className="home-intro-feature__image-shell">
                    <div className="home-intro-feature__image">{image}</div>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        );
      }

      if (variant === 'split' && image) {
        return (
          <section className="text-content-section text-content-section--split">
            <div className="home-intro-feature home-intro-feature--split container">
              <div className="home-intro-feature__copy">
                {sectionHeading ? <SectionHeadingTag>{sectionHeading}</SectionHeadingTag> : null}
                {sectionAccent ? <p className="home-intro-feature__accent">{sectionAccent}</p> : null}
                {sectionLede ? (
                  <div className="home-intro-feature__lede">
                    <MarkdownLite content={sectionLede} />
                  </div>
                ) : null}
              </div>
              <div className="home-intro-feature__visual">
                <div className="home-intro-feature__image-shell">
                  <div className="home-intro-feature__image">{image}</div>
                </div>
              </div>
            </div>
          </section>
        );
      }

      return (
        <section className="text-content-section">
          <div className="container">
          {sectionHeading ? <SectionHeadingTag>{sectionHeading}</SectionHeadingTag> : null}
          {sectionAccent ? <p>{sectionAccent}</p> : null}
          {sectionLede ? <MarkdownLite content={sectionLede} /> : null}
          </div>
        </section>
      );
    }

    case 'content_2_column_section': {
      const variant = getString(data.variant).trim() === 'media_left' ? 'media_left' : 'media_right';
      const imageUrl = sectionImage;
      const image = imageUrl ? (
        <AppImage
          role="content"
          src={imageUrl}
          alt={sectionHeading || rawHeading || ''}
          width={1150}
          height={1152}
        />
      ) : null;

      return (
        <section className={`text-content-section text-content-section--2-column text-content-section--${variant}`}>
          <div className={`home-intro-feature home-intro-feature--2-column home-intro-feature--${variant} container`}>
            <div className="home-intro-feature__copy">
              {sectionHeading ? <SectionHeadingTag>{sectionHeading}</SectionHeadingTag> : null}
              {sectionAccent ? <p className="home-intro-feature__accent">{sectionAccent}</p> : null}
              {sectionLede ? (
                <div className="home-intro-feature__lede">
                  <MarkdownLite content={sectionLede} />
                </div>
              ) : null}
            </div>
            {image ? (
              <div className="home-intro-feature__visual">
                <div className="home-intro-feature__image-shell">
                  <div className="home-intro-feature__image">{image}</div>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      );
    }

    case 'flexible_section': {
      const layout = getString(data.layout).trim() || 'one_column';
      const variant = getString(data.variant).trim() || 'default';
      const supportingKind = getString(data.supportingKind).trim() || 'none';
      const contentBlocks = Array.isArray(data.contentBlocks)
        ? (data.contentBlocks as Array<{ type: string; data: Record<string, unknown> }>)
        : [];
      const supportingBlocks = Array.isArray(data.supportingBlocks)
        ? (data.supportingBlocks as Array<{ type: string; data: Record<string, unknown> }>)
        : [];
      const useContextFeaturedImage = data.useContextFeaturedImage === true;
      const contextFeaturedImage =
        context?.service?.featured_image_url ||
        context?.area?.featured_image_url ||
        context?.blogPost?.featured_image_url ||
        '';
      const supportingImage = useContextFeaturedImage
        ? contextFeaturedImage
        : getString(data.supportingImage).trim();
      const supportingImageAlt = resolveText(data.supportingImageAlt).trim();
      const oneColumnBackgroundImage =
        layout === 'one_column' && supportingKind === 'image' && supportingImage
          ? supportingImage
          : '';
      const supportingVideoUrl = getString(data.supportingVideoUrl).trim();
      const supportingFormId = getString(data.supportingFormId).trim();
      const supportingUnavailableText = resolveText(data.supportingUnavailableText).trim();
      const supportingLogos = getList(data.logos)
        .map((item) => {
          const logo = getObject(item);
          return {
            image: getString(logo.image).trim(),
            alt: resolveText(logo.alt).trim(),
            label: resolveText(logo.label).trim(),
            href: resolveText(logo.href).trim(),
          };
        })
        .filter((logo) => logo.image || logo.label || logo.alt || logo.href);
      const selectedForm =
        supportingKind === 'form' && supportingFormId
          ? await adapter.getActiveFormById(supportingFormId)
          : null;
      const selectedFields = toFrontendFormFields(selectedForm?.fields);
      const hasContentHeader = Boolean(sectionAccent || sectionHeading || sectionLede);
      const hasContentBlocks = contentBlocks.length > 0;
      const hasPrimaryButton = data.primaryButton === true;
      const hasSecondaryButton = data.secondaryButton === true;
      const hasActions = hasPrimaryButton || hasSecondaryButton;

      const supportingNode = (() => {
        if (layout === 'one_column' || supportingKind === 'none') return null;

        if (supportingKind === 'blocks') {
          return supportingBlocks.length > 0 ? (
            <BlockRenderer blocks={supportingBlocks} className="section__supporting-blocks" />
          ) : null;
        }

        if (supportingKind === 'image') {
          return supportingImage ? (
            <div className={getFlexMediaPlacementClass(layout, 'img')}>
              <div className="img">
                <AppImage
                  role="content"
                  src={supportingImage}
                  alt={supportingImageAlt}
                  width={1400}
                  height={1050}
                  priority
                  fetchPriority="high"
                  loading="eager"
                  sizes={layout === 'one_column' ? '(max-width: 575px) calc(100vw - 2rem), (max-width: 991px) min(92vw, 860px), min(82vw, 1200px)' : '(max-width: 575px) calc(100vw - 2rem), (max-width: 991px) calc(50vw - 1.5rem), calc(42vw - 2rem)'}
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              </div>
            </div>
          ) : null;
        }

        if (supportingKind === 'form') {
          if (context?.contact?.businessId && selectedForm?.id && selectedFields.length > 0) {
            return (
              <div className={getFlexMediaPlacementClass(layout, 'form')}>
                <FrontendForm
                  businessId={context.contact.businessId}
                  formType="contact"
                  services={(context.contact.services ?? []).map((service) => ({ id: service.id, title: service.title }))}
                  fields={selectedFields}
                  formId={selectedForm.id}
                  submitLabel="Send Message"
                  successTitle="Thank you!"
                  successMessage="We'll be in touch shortly."
                  className="form"
                />
              </div>
            );
          }
          return supportingUnavailableText ? <p>{supportingUnavailableText}</p> : null;
        }

        if (supportingKind === 'video') {
          if (!supportingVideoUrl) return null;

          const isEmbedUrl =
            supportingVideoUrl.includes('youtube.com') ||
            supportingVideoUrl.includes('youtu.be') ||
            supportingVideoUrl.includes('vimeo.com');

          return (
            <div className={getFlexMediaPlacementClass(layout, 'vid')}>
              <div className="vid">
                {isEmbedUrl ? (
                  <iframe
                    src={supportingVideoUrl}
                    title={sectionHeading || 'Embedded video'}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                ) : (
                  <video
                    controls
                    playsInline
                    preload="metadata"
                    src={supportingVideoUrl}
                  />
                )}
              </div>
            </div>
          );
        }

        if (supportingKind === 'logos') {
          return supportingLogos.length > 0 ? (
            <div className="section__logos">
              {supportingLogos.map((logo, index) => {
                const content = (
                  <>
                    {logo.image ? (
                      <span className="section__logo-media">
                        <AppImage
                          role="content"
                          src={logo.image}
                          alt={logo.alt || logo.label || ''}
                          width={240}
                          height={120}
                          className="section__logo-image"
                        />
                      </span>
                    ) : null}
                    {logo.label ? <span className="section__logo-label">{logo.label}</span> : null}
                  </>
                );

                return logo.href ? (
                  <Link key={`flex-logo-${index}`} href={logo.href} className="section__logo-item">
                    {content}
                  </Link>
                ) : (
                  <div key={`flex-logo-${index}`} className="section__logo-item">
                    {content}
                  </div>
                );
              })}
            </div>
          ) : null;
        }

        return null;
      })();

      return (
        <section
          className={[
            'content-section',
            'flex-section',
            `flex-section--${layout}`,
            oneColumnBackgroundImage ? 'flex-section--with-bg-image' : '',
          ].join(' ')}
          data-section-type="flex"
          data-layout={layout}
          data-variant={variant}
          data-page-context={pageContext}
          style={oneColumnBackgroundImage ? { position: 'relative', overflow: 'hidden' } : undefined}
        >
          {oneColumnBackgroundImage ? (
            <div aria-hidden="true" className="section__bg" style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
              <AppImage
                role="hero"
                src={oneColumnBackgroundImage}
                alt={supportingImageAlt || ''}
                fill
                style={{ objectFit: 'cover' }}
              />
              <div
                className="section__bg-overlay"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(rgba(15, 23, 42, 0.58), rgba(15, 23, 42, 0.58))',
                }}
              />
            </div>
          ) : null}
          <div className="container" style={oneColumnBackgroundImage ? { position: 'relative', zIndex: 1 } : undefined}>
            <div className="grid-col">
              {hasContentHeader ? (
                <>
                  {sectionAccent ? <p className="accent">{sectionAccent}</p> : null}
                  {sectionHeading ? <SectionHeadingTag>{sectionHeading}</SectionHeadingTag> : null}
                  {sectionLede ? <p className="lede">{sectionLede}</p> : null}
                </>
              ) : null}
              {hasContentBlocks ? <BlockRenderer blocks={contentBlocks} className="body-content" /> : null}
              {hasActions ? (
                <div className="btn-group">
                  {hasPrimaryButton ? <Link href={defaultPrimaryCtaHref} className="primary-btn">{defaultPrimaryCtaLabel}</Link> : null}
                  {hasSecondaryButton ? (
                    <Link href={defaultSecondaryCtaHref} className="secondary-btn">
                      {defaultSecondaryCtaLabel}
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
            {supportingNode ? <div>{supportingNode}</div> : null}
          </div>
        </section>
      );
    }

    case 'flexible_form_section': {
      if ((section.slotId ?? '').trim() === 'contact_form_section') {
        return renderLegacyContactFormSection();
      }

      const layout = getString(data.layout).trim() || 'one_column';
      const variant = getString(data.variant).trim() || 'default';
      const contentBlocks = Array.isArray(data.contentBlocks)
        ? (data.contentBlocks as Array<{ type: string; data: Record<string, unknown> }>)
        : [];
      const supportingImage = getString(data.supportingImage).trim();
      const supportingImageAlt = resolveText(data.supportingImageAlt).trim();
      const sectionFormId = getString(data.contact_form_id).trim();
      const unavailableText = resolveText(data.unavailableText).trim();
      const selectedForm = sectionFormId ? await adapter.getActiveFormById(sectionFormId) : null;
      const selectedFields = toFrontendFormFields(selectedForm?.fields);
      const hasContentHeader = Boolean(sectionAccent || sectionHeading || sectionLede);
      const hasContentBlocks = contentBlocks.length > 0;
      const hasPrimaryButton = data.primaryButton === true;
      const hasSecondaryButton = data.secondaryButton === true;
      const hasActions = hasPrimaryButton || hasSecondaryButton;
      const formNode =
        context?.contact?.businessId && selectedForm?.id && selectedFields.length > 0 ? (
          <FrontendForm
            businessId={context.contact.businessId}
            formType="contact"
            services={(context.contact.services ?? []).map((service) => ({ id: service.id, title: service.title }))}
            fields={selectedFields}
            formId={selectedForm.id}
            submitLabel="Send Message"
            successTitle="Thank you!"
            successMessage="We'll be in touch shortly."
            className="form"
          />
        ) : unavailableText ? (
          <p>{unavailableText}</p>
        ) : null;
      const supportingNode =
        layout !== 'one_column' && supportingImage ? (
          <div className={getFlexMediaPlacementClass(layout, 'img')}>
            <div className="img">
              <AppImage
                role="content"
                src={supportingImage}
                alt={supportingImageAlt}
                width={1400}
                height={1050}
              />
            </div>
          </div>
        ) : null;

      return (
        <section
          className={['content-section', 'flex-section', 'flex-form-section', `flex-section--${layout}`].join(' ')}
          data-section-type="flex-form"
          data-layout={layout}
          data-variant={variant}
          data-page-context={pageContext}
        >
          <div className="container">
            <div className="grid-col">
              {hasContentHeader ? (
                <>
                  {sectionAccent ? <p className="accent">{sectionAccent}</p> : null}
                  {sectionHeading ? <SectionHeadingTag>{sectionHeading}</SectionHeadingTag> : null}
                  {sectionLede ? <p className="lede">{sectionLede}</p> : null}
                </>
              ) : null}
              {hasContentBlocks ? <BlockRenderer blocks={contentBlocks} className="body-content" /> : null}
              {formNode}
              {hasActions ? (
                <div className="btn-group">
                  {hasPrimaryButton ? <Link href={defaultPrimaryCtaHref} className="primary-btn">{defaultPrimaryCtaLabel}</Link> : null}
                  {hasSecondaryButton ? (
                    <Link href={defaultSecondaryCtaHref} className="secondary-btn">
                      {defaultSecondaryCtaLabel}
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
            {supportingNode ? <div>{supportingNode}</div> : null}
          </div>
        </section>
      );
    }

    case 'list_section': {
      const variant = getString(data.variant).trim() === 'ordered' ? 'ordered' : 'unordered';
      const items = getList(data.items)
        .map((item: unknown) => getObject(item))
        .map((item: Record<string, unknown>) => ({
          title: getString(item.title).trim(),
          body: getString(item.body).trim(),
        }))
        .filter((item: { title: string; body: string }) => item.title.length > 0 || item.body.length > 0);
      const ListTag = variant === 'ordered' ? 'ol' : 'ul';

      return (
        <section className={`text-content-section list-section list-section--${variant}`}>
          <div className="container">
            {sectionAccent ? <p>{sectionAccent}</p> : null}
            {sectionHeading ? <SectionHeadingTag>{sectionHeading}</SectionHeadingTag> : null}
            {sectionLede ? <MarkdownLite content={sectionLede} /> : null}
            {items.length > 0 ? (
              <ListTag className="list-section__items">
                {items.map((item: { title: string; body: string }, index: number) => (
                  <li key={`list-section-item-${index}`} className="list-section__item">
                    {item.title ? <strong className="list-section__item-title">{item.title}</strong> : null}
                    {item.body ? (
                      <div className="list-section__item-body">
                        <MarkdownLite content={item.body} />
                      </div>
                    ) : null}
                  </li>
                ))}
              </ListTag>
            ) : null}
          </div>
        </section>
      );
    }

    case 'table_section': {
      const columns = getList(data.columns)
        .map((column: unknown) => getString(column).trim())
        .filter((column: string) => column.length > 0);
      const rows = getList(data.rows)
        .map((row: unknown) => getObject(row))
        .map((row: Record<string, unknown>) => getList(row.cells).map((cell: unknown) => getString(cell).trim()))
        .filter((cells: string[]) => cells.some((cell: string) => cell.length > 0));
      const columnCount = Math.max(columns.length, ...rows.map((cells: string[]) => cells.length), 0);
      const normalizedRows = rows.map((cells: string[]) =>
        Array.from({ length: columnCount }, (_, index) => cells[index] ?? ''),
      );

      return (
        <section className="text-content-section table-section">
          <div className="container">
            {sectionAccent ? <p>{sectionAccent}</p> : null}
            {sectionHeading ? <SectionHeadingTag>{sectionHeading}</SectionHeadingTag> : null}
            {sectionLede ? <MarkdownLite content={sectionLede} /> : null}
            {columnCount > 0 ? (
              <div className="table-section__wrap">
                <table className="table-section__table">
                  {columns.length > 0 ? (
                    <thead>
                      <tr>
                        {Array.from({ length: columnCount }, (_, index) => (
                          <th key={`table-section-heading-${index}`} scope="col">
                            {columns[index] ?? ''}
                          </th>
                        ))}
                      </tr>
                    </thead>
                  ) : null}
                  <tbody>
                    {normalizedRows.map((cells: string[], rowIndex: number) => (
                      <tr key={`table-section-row-${rowIndex}`}>
                        {cells.map((cell: string, cellIndex: number) => (
                          <td key={`table-section-cell-${rowIndex}-${cellIndex}`}>
                            {cell ? <MarkdownLite content={cell} /> : null}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </section>
      );
    }

    case 'long_form_body_section':
      {
        const longFormContextClass = context?.service
          ? 'block-renderer--service'
          : context?.area
            ? 'block-renderer--area'
            : context?.blogPost
              ? 'block-renderer--blog'
              : 'block-renderer--page';
        const rawRhythmImages = [
          ...(context?.galleryImages ?? []),
          ...(context?.service?.featured_image_url
            ? [{ id: `${context.service.id}-featured-image`, file_url: context.service.featured_image_url, caption: context.service.title ?? null }]
            : []),
          ...(context?.area?.featured_image_url
            ? [{ id: `${context.area.id}-featured-image`, file_url: context.area.featured_image_url, caption: context.area.name ?? null }]
            : []),
          ...(context?.blogPost?.featured_image_url
            ? [{ id: `${context.blogPost.id}-featured-image`, file_url: context.blogPost.featured_image_url, caption: context.blogPost.title ?? null }]
            : []),
          ...((context?.relatedBlogPosts ?? [])
            .filter((post) => typeof post.featured_image_url === 'string' && post.featured_image_url.trim().length > 0)
            .map((post) => ({
              id: `${post.id}-featured-image`,
              file_url: (post.featured_image_url ?? '').trim(),
              caption: post.title ?? null,
            }))),
        ];
        const rhythmImages = rawRhythmImages
          .filter((image) => typeof image.file_url === 'string' && image.file_url.trim().length > 0)
          .filter((image, index, allImages) => allImages.findIndex((candidate) => candidate.file_url === image.file_url) === index)
          .slice(0, 6);
      return (
        <section className={`long-form-section ${longFormContextClass}`}>
          <div className="container body-content">
          {Array.isArray(data.blocks) && data.blocks.length > 0 ? (
            <BlockRenderer
              blocks={data.blocks as Array<{ type: string; data: Record<string, unknown> }>}
              className={longFormContextClass}
              rhythmImages={rhythmImages}
              enableImageRhythm={rhythmImages.length > 0}
            />
          ) : null}
          </div>
        </section>
      );
      }

    case 'cta_band': {
      const cta = getObject(data.cta);
      const ctaHref = getString(cta.href).trim() || defaultPrimaryCtaHref;
      const layout = getString(data.layout).trim() || getString(data.variant).trim() || 'default';
      const variant = ['boxed', 'minimal', 'contrast'].includes(getString(data.variant).trim())
        ? getString(data.variant).trim()
        : 'default';

      if (layout === 'feature') {
        const mediaImages = await adapter.getPrimaryServiceGalleryImages(6);
        const availableBgImages = mediaImages
          .map((item) => (typeof item.file_url === 'string' ? item.file_url.trim() : ''))
          .filter((url): url is string => url.length > 0);
        const backdropMosaicUrls =
          availableBgImages.length > 0 ? Array.from({ length: 6 }, (_, index) => availableBgImages[index % availableBgImages.length]) : [];
        return (
          <section className={`cta-section cta-section--feature cta-section--variant-${variant}`} data-layout={layout} data-variant={variant}>
            <div className={`cta-banner cta-banner--feature cta-banner--variant-${variant} container`}>
              <div className="cta-banner__backdrop" aria-hidden="true">
                {backdropMosaicUrls.length > 0 ? (
                  <div className="cta-banner__backdrop-mosaic">
                    {backdropMosaicUrls.map((url, index) => (
                      <div
                        key={`cta-backdrop-mosaic-${url}-${index}`}
                        className={`cta-banner__backdrop-tile cta-banner__backdrop-tile--${index + 1}`}
                      >
                        <AppImage role="gallery" src={url} alt="" width={900} height={675} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="cta-banner__image-fallback" />
                )}
              </div>
              <div className="cta-banner__inner">
                <div className="cta-banner__copy">
                  {sectionHeading ? <SectionHeadingTag className="cta-banner__title">{sectionHeading}</SectionHeadingTag> : null}
                  {sectionAccent ? <p className="cta-banner__accent">{sectionAccent}</p> : null}
                  {sectionLede ? <p className="cta-banner__text">{sectionLede}</p> : null}
                  <div className="cta-banner__actions">
                    <PrimaryButton href={ctaHref} size="btn--lg">{defaultPrimaryCtaLabel}</PrimaryButton>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      }

      if (layout === 'split') {
        return (
          <section className={`cta-section cta-section--split cta-section--variant-${variant}`} data-layout={layout} data-variant={variant}>
            <div className={`cta-banner cta-banner--split cta-banner--variant-${variant} container`}>
              <div className="cta-banner__layout">
                <div className="cta-banner__copy">
                  {sectionHeading ? <SectionHeadingTag className="cta-banner__title">{sectionHeading}</SectionHeadingTag> : null}
                  {sectionAccent ? <p className="cta-banner__accent">{sectionAccent}</p> : null}
                  {sectionLede ? <p className="cta-banner__text">{sectionLede}</p> : null}
                </div>
                <div className="cta-banner__aside">
                  <div className="cta-banner__actions">
                    <PrimaryButton href={ctaHref} size="btn--lg">{defaultPrimaryCtaLabel}</PrimaryButton>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      }

      return (
        <section className={`cta-section cta-section--default cta-section--variant-${variant}`} data-layout={layout} data-variant={variant}>
          <div className={`cta-banner cta-banner--default cta-banner--variant-${variant} container`}>
            {sectionHeading ? <SectionHeadingTag className="cta-banner__title">{sectionHeading}</SectionHeadingTag> : null}
            {sectionAccent ? <p className="cta-banner__accent">{sectionAccent}</p> : null}
            {sectionLede ? <p className="cta-banner__text">{sectionLede}</p> : null}
            <div className="cta-banner__actions">
              <PrimaryButton href={ctaHref} size="btn--lg">{defaultPrimaryCtaLabel}</PrimaryButton>
            </div>
          </div>
        </section>
      );
    }

    case 'flexible_cta_section': {
      const layout = getString(data.layout).trim() || 'one_column';
      const variant = getString(data.variant).trim() || 'default';
      const ctaType = getString(data.ctaType).trim() || 'general';
      const hasPrimaryButton = data.primaryButton !== false;
      const hasSecondaryButton = data.secondaryButton === true;
      const contentBlocks = Array.isArray(data.contentBlocks)
        ? (data.contentBlocks as Array<{ type: string; data: Record<string, unknown> }>)
        : [];
      const supportingKind = getString(data.supportingKind).trim() || 'none';
      const supportingImage = getString(data.supportingImage).trim();
      const supportingImageAlt = resolveText(data.supportingImageAlt).trim();
      const supportingVideoUrl = getString(data.supportingVideoUrl).trim();
      const supportingFormId = getString(data.supportingFormId).trim();
      const supportingUnavailableText = resolveText(data.supportingUnavailableText).trim();
      const selectedForm =
        supportingKind === 'form' && supportingFormId
          ? await adapter.getActiveFormById(supportingFormId)
          : null;
      const selectedFields = toFrontendFormFields(selectedForm?.fields);
      const hasContentHeader = Boolean(sectionAccent || sectionHeading || sectionLede);
      const hasContentBlocks = contentBlocks.length > 0;
      const supportingNode = (() => {
        if (layout === 'one_column' || supportingKind === 'none') return null;

        if (supportingKind === 'image') {
          return supportingImage ? (
            <div className={getFlexMediaPlacementClass(layout, 'img')}>
              <div className="img">
                <AppImage
                  role="content"
                  src={supportingImage}
                  alt={supportingImageAlt}
                  width={1400}
                  height={1050}
                />
              </div>
            </div>
          ) : null;
        }

        if (supportingKind === 'form') {
          if (context?.contact?.businessId && selectedForm?.id && selectedFields.length > 0) {
            return (
              <div className={getFlexMediaPlacementClass(layout, 'form')}>
                <FrontendForm
                  businessId={context.contact.businessId}
                  formType="contact"
                  services={(context.contact.services ?? []).map((service) => ({ id: service.id, title: service.title }))}
                  fields={selectedFields}
                  formId={selectedForm.id}
                  submitLabel="Send Message"
                  successTitle="Thank you!"
                  successMessage="We'll be in touch shortly."
                  className="form"
                />
              </div>
            );
          }
          return supportingUnavailableText ? <p>{supportingUnavailableText}</p> : null;
        }

        if (supportingKind === 'video') {
          if (!supportingVideoUrl) return null;
          const isEmbedUrl =
            supportingVideoUrl.includes('youtube.com') ||
            supportingVideoUrl.includes('youtu.be') ||
            supportingVideoUrl.includes('vimeo.com');

          return (
            <div className={getFlexMediaPlacementClass(layout, 'vid')}>
              <div className="vid">
                {isEmbedUrl ? (
                  <iframe
                    src={supportingVideoUrl}
                    title={sectionHeading || 'Embedded video'}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                ) : (
                  <video
                    controls
                    playsInline
                    preload="metadata"
                    src={supportingVideoUrl}
                  />
                )}
              </div>
            </div>
          );
        }

        return null;
      })();
      return (
        <section
          className={[
            'content-section',
            'flex-section',
            'flex-cta-section',
            `flex-section--${layout}`,
            `flex-cta-section--${ctaType}`,
          ].join(' ')}
          data-section-type="flex-cta"
          data-cta-type={ctaType}
          data-layout={layout}
          data-variant={variant}
          data-page-context={pageContext}
        >
          <div className="container">
            <div className="grid-col">
              {hasContentHeader ? (
                <>
                  {sectionHeading ? <SectionHeadingTag>{sectionHeading}</SectionHeadingTag> : null}
                  {sectionAccent ? <p className="accent">{sectionAccent}</p> : null}
                  {sectionLede ? <p className="lede">{sectionLede}</p> : null}
                </>
              ) : null}
              {hasContentBlocks ? <BlockRenderer blocks={contentBlocks} className="body-content" /> : null}
              <div className="btn-group">
                {hasPrimaryButton ? <Link href={defaultPrimaryCtaHref} className="primary-btn">{defaultPrimaryCtaLabel}</Link> : null}
                {hasSecondaryButton ? (
                  <Link href={defaultSecondaryCtaHref} className="secondary-btn">
                    {defaultSecondaryCtaLabel}
                  </Link>
                ) : null}
              </div>
            </div>
            {supportingNode ? <div>{supportingNode}</div> : null}
          </div>
        </section>
      );
    }

    case 'flexible_hero_section': {
      const layout = getString(data.layout).trim() || 'one_column';
      const variant = getString(data.variant).trim() || 'default';
      const heroType =
        pageContext === 'service' ? 'service'
          : pageContext === 'contact' ? 'contact'
          : pageContext === 'blog' ? 'blog'
          : pageContext === 'area' ? 'area'
          : pageContext === 'home' ? 'home'
          : pageContext === 'about' ? 'about'
          : 'general';
      const hasPrimaryButton = data.primaryButton !== false;
      const hasSecondaryButton = data.secondaryButton === true;
      const contentBlocks = Array.isArray(data.contentBlocks)
        ? (data.contentBlocks as Array<{ type: string; data: Record<string, unknown> }>)
        : [];
      const supportingKind = getString(data.supportingKind).trim() || 'none';
      const useContextFeaturedImage = data.useContextFeaturedImage === true;
      const contextFeaturedImage =
        context?.service?.featured_image_url ||
        context?.area?.featured_image_url ||
        context?.blogPost?.featured_image_url ||
        '';
      const supportingImage = useContextFeaturedImage
        ? contextFeaturedImage
        : getString(data.supportingImage).trim();
      const supportingImageAlt = resolveText(data.supportingImageAlt).trim();
      const oneColumnBackgroundImage =
        layout === 'one_column' && supportingKind === 'image' && supportingImage
          ? supportingImage
          : '';
      const supportingVideoUrl = getString(data.supportingVideoUrl).trim();
      const supportingFormId = getString(data.supportingFormId).trim();
      const supportingUnavailableText = resolveText(data.supportingUnavailableText).trim();
      const selectedForm =
        supportingKind === 'form' && supportingFormId
          ? await adapter.getActiveFormById(supportingFormId)
          : null;
      const selectedFields = toFrontendFormFields(selectedForm?.fields);
      const hasContentHeader = Boolean(sectionAccent || sectionHeading || sectionLede);
      const hasContentBlocks = contentBlocks.length > 0;
      const supportingNode = (() => {
        if (layout === 'one_column' || supportingKind === 'none') return null;

        if (supportingKind === 'image') {
          return supportingImage ? (
            <div className={getFlexMediaPlacementClass(layout, 'img')}>
              <div className="img">
                <AppImage
                  role="content"
                  src={supportingImage}
                  alt={supportingImageAlt}
                  width={1400}
                  height={1050}
                />
              </div>
            </div>
          ) : null;
        }

        if (supportingKind === 'form') {
          if (context?.contact?.businessId && selectedForm?.id && selectedFields.length > 0) {
            return (
              <div className={getFlexMediaPlacementClass(layout, 'form')}>
                <FrontendForm
                  businessId={context.contact.businessId}
                  formType="contact"
                  services={(context.contact.services ?? []).map((service) => ({ id: service.id, title: service.title }))}
                  fields={selectedFields}
                  formId={selectedForm.id}
                  submitLabel="Send Message"
                  successTitle="Thank you!"
                  successMessage="We'll be in touch shortly."
                  className="form"
                />
              </div>
            );
          }
          return supportingUnavailableText ? <p>{supportingUnavailableText}</p> : null;
        }

        if (supportingKind === 'video') {
          if (!supportingVideoUrl) return null;
          const isEmbedUrl =
            supportingVideoUrl.includes('youtube.com') ||
            supportingVideoUrl.includes('youtu.be') ||
            supportingVideoUrl.includes('vimeo.com');

          return (
            <div className={getFlexMediaPlacementClass(layout, 'vid')}>
              <div className="vid">
                {isEmbedUrl ? (
                  <iframe
                    src={supportingVideoUrl}
                    title={sectionHeading || 'Embedded video'}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                ) : (
                  <video
                    controls
                    playsInline
                    preload="metadata"
                    src={supportingVideoUrl}
                  />
                )}
              </div>
            </div>
          );
        }

        return null;
      })();
      return (
        <section
          className={[
            'content-section',
            'flex-section',
            'flex-hero-section',
            `flex-section--${layout}`,
            `flex-hero-section--${heroType}`,
            oneColumnBackgroundImage ? 'flex-hero-section--with-bg-image' : '',
          ].join(' ')}
          data-section-type="flex-hero"
          data-hero-type={heroType}
          data-layout={layout}
          data-variant={variant}
          data-page-context={pageContext}
          style={oneColumnBackgroundImage ? { position: 'relative', overflow: 'hidden' } : undefined}
        >
          {oneColumnBackgroundImage ? (
            <div aria-hidden="true" className="section__bg" style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
              <AppImage
                role="hero"
                src={oneColumnBackgroundImage}
                alt={supportingImageAlt || ''}
                fill
                style={{ objectFit: 'cover' }}
              />
              <div
                className="section__bg-overlay"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(rgba(15, 23, 42, 0.58), rgba(15, 23, 42, 0.58))',
                }}
              />
            </div>
          ) : null}
          <div className="container" style={oneColumnBackgroundImage ? { position: 'relative', zIndex: 1 } : undefined}>
            <div className="grid-col">
              {hasContentHeader ? (
                <>
                  {sectionHeading ? <SectionHeadingTag>{sectionHeading}</SectionHeadingTag> : null}
                  {sectionAccent ? <p className="accent">{sectionAccent}</p> : null}
                  {sectionLede ? <p className="lede">{sectionLede}</p> : null}
                </>
              ) : null}
              {hasContentBlocks ? <BlockRenderer blocks={contentBlocks} className="body-content" /> : null}
              <div className="btn-group">
                {hasPrimaryButton ? <Link href={defaultPrimaryCtaHref} className="primary-btn">{defaultPrimaryCtaLabel}</Link> : null}
                {hasSecondaryButton ? (
                  <Link href={defaultSecondaryCtaHref} className="secondary-btn">
                    {defaultSecondaryCtaLabel}
                  </Link>
                ) : null}
              </div>
            </div>
            {supportingNode ? <div>{supportingNode}</div> : null}
          </div>
        </section>
      );
    }

    default:
      return null;
  }
}




export default RenderedSection;















