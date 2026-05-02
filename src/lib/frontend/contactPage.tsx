import { PageSection, type FrontendFormField } from '@/lib/sections-core/frontend';
import BlockRenderer from '@/components/shared/BlockRenderer';
import AppImage from '@/components/shared/AppImage';
import ManagedFrontendForm from '@/components/frontend/ManagedFrontendForm';
import TemplatePageRenderer from '@/components/integrations/TemplatePageRenderer';
import { toTemplatePageContent } from '@/lib/sections/templatePages';
import { getActiveArchivePagePaths, getPrimaryServiceGalleryImages } from '@/lib/content/queries';
import { getActiveFormById } from '@/lib/forms/queries';
import { getActiveServices } from '@/lib/services/queries';
import { toBlocks } from '@/lib/frontend/content';
import { getBusiness } from '@/lib/utils/business';
import type { Tables } from '@/lib/types/database';

type Page = Tables<'pages'>;
type ContactFrontendFormField = FrontendFormField & { enableGoogleMaps?: boolean };

function getSettingsString(settings: unknown, key: string): string {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return '';
  const value = (settings as Record<string, unknown>)[key];
  return typeof value === 'string' ? value.trim() : '';
}

function toFrontendFormFields(value: unknown): ContactFrontendFormField[] {
  if (!Array.isArray(value)) return [];
  const parsed = value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const row = item as Record<string, unknown>;
      if (typeof row.name !== 'string' || typeof row.label !== 'string' || typeof row.type !== 'string') return null;

      const field: ContactFrontendFormField = {
        id: typeof row.id === 'string' ? row.id : row.name,
        name: row.name,
        label: row.label,
        type: row.type as FrontendFormField['type'],
        placeholder: typeof row.placeholder === 'string' ? row.placeholder : '',
        required: row.required === true,
        helpText: typeof row.helpText === 'string' ? row.helpText : '',
        options: Array.isArray(row.options) ? row.options.filter((option): option is string => typeof option === 'string') : [],
        row: typeof row.row === 'number' && Number.isFinite(row.row) ? Math.max(1, Math.trunc(row.row)) : undefined,
        span:
          typeof row.span === 'number' && Number.isFinite(row.span)
            ? Math.max(1, Math.min(12, Math.trunc(row.span)))
            : undefined,
        enableGoogleMaps: row.type === 'address' ? row.enableGoogleMaps !== false : undefined,
      };
      return field;
    });
  return parsed.filter((field): field is ContactFrontendFormField => field !== null);
}

export async function renderContactPageContent(page: Page | null) {
  const [business, services, contactGalleryImages, archivePaths] = await Promise.all([
    getBusiness(),
    getActiveServices(),
    getPrimaryServiceGalleryImages(6),
    getActiveArchivePagePaths(),
  ]);

  const selectedContactFormId = getSettingsString(business?.settings, 'contact_form_id');
  const configuredContactForm = selectedContactFormId ? await getActiveFormById(selectedContactFormId) : null;
  const businessId = business?.id ?? '';
  const templateContent = toTemplatePageContent(page?.content);
  const blocks = templateContent ? [] : toBlocks(page?.content);
  const configuredFields = toFrontendFormFields(configuredContactForm?.fields);
  const hasRenderableContactForm = Boolean(businessId && configuredContactForm?.id && configuredFields.length > 0);
  const contactImagePool = contactGalleryImages
    .map((item) => (typeof item.file_url === 'string' ? item.file_url.trim() : ''))
    .filter((url): url is string => url.length > 0);
  const contactMosaicUrls = Array.from({ length: 6 }, (_, index) => contactImagePool[index % contactImagePool.length]);

  return (
    <div className="page page--contact">
      {templateContent ? (
        <TemplatePageRenderer
          content={templateContent}
          context={{
            page: { title: page?.title, metaDescription: page?.meta_description },
            business,
            services,
            archivePaths,
            url: page?.slug ? `/${page.slug}` : '/contact',
            contact: {
              business,
              services,
              businessId,
              configuredFields,
              formId: configuredContactForm?.id ?? undefined,
            },
          }}
        />
      ) : (
        <BlockRenderer blocks={blocks} />
      )}
      {!templateContent && (
        <PageSection heading="Form" className="contact-section">
          <div className="contact__layout">
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
            <div className="contact__hero-col">
              <div className="contact__brand">
                {business?.logo_url ? (
                  <AppImage
                    className="contact__brand-logo"
                    role="logo"
                    src={business.logo_url}
                    alt={`${business?.name ?? 'Company'} logo`}
                    width={220}
                    height={110}
                  />
                ) : (
                  <span>{business?.name ?? 'Company'}</span>
                )}
              </div>
            </div>
            <div className="contact__form-col">
              {hasRenderableContactForm ? (
                <ManagedFrontendForm
                  businessId={businessId}
                  formType="contact"
                  services={services.map((service) => ({ id: service.id, title: service.title }))}
                  fields={configuredFields}
                  formId={configuredContactForm?.id ?? undefined}
                  submitLabel="Send Message"
                  successTitle="Thank you!"
                  successMessage="We'll be in touch shortly."
                  className="contact-form"
                />
              ) : (
                <p>Form is unavailable right now.</p>
              )}
            </div>
          </div>
        </PageSection>
      )}
    </div>
  );
}
