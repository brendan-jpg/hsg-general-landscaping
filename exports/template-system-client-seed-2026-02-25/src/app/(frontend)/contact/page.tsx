import ContactForm from '../../../components/frontend/ContactForm';
import type { ContactFormField } from '../../../components/frontend/ContactForm';
import ContentPageHeader from '../../../components/frontend/ContentPageHeader';
import BlockRenderer from '../../../components/shared/BlockRenderer';
import TemplatePageRenderer from '../../../components/shared/TemplatePageRenderer';
import PageSection from '../../../components/frontend/PageSection';
import TrackedPhoneLink from '@/components/analytics/TrackedPhoneLink';
import { toTemplatePageContent } from '@/lib/content/templatePages';
import { getActivePageBySlug } from '@/lib/content/queries';
import { getActiveFormById, getActiveFormBySlug } from '@/lib/forms/queries';
import { getActiveServices } from '@/lib/services/queries';
import { toBlocks } from '@/lib/frontend/content';
import { getBusiness } from '@/lib/utils/business';

function getSettingsString(settings: unknown, key: string): string {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return '';
  const value = (settings as Record<string, unknown>)[key];
  return typeof value === 'string' ? value.trim() : '';
}

function toContactFormFields(value: unknown): ContactFormField[] {
  if (!Array.isArray(value)) return [];
  const parsed = value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const row = item as Record<string, unknown>;
      if (typeof row.name !== 'string' || typeof row.label !== 'string' || typeof row.type !== 'string') return null;

      const field: ContactFormField = {
        id: typeof row.id === 'string' ? row.id : row.name,
        name: row.name,
        label: row.label,
        type: row.type as ContactFormField['type'],
        placeholder: typeof row.placeholder === 'string' ? row.placeholder : '',
        required: row.required === true,
        helpText: typeof row.helpText === 'string' ? row.helpText : '',
        options: Array.isArray(row.options) ? row.options.filter((option): option is string => typeof option === 'string') : [],
        row: typeof row.row === 'number' && Number.isFinite(row.row) ? Math.max(1, Math.trunc(row.row)) : undefined,
        span:
          typeof row.span === 'number' && Number.isFinite(row.span)
            ? Math.max(1, Math.min(12, Math.trunc(row.span)))
            : undefined,
      };
      return field;
    });
  return parsed.filter((field): field is ContactFormField => field !== null);
}

export default async function ContactPage() {
  const [business, services, page] = await Promise.all([
    getBusiness(),
    getActiveServices(),
    getActivePageBySlug('contact'),
  ]);
  const selectedContactFormId = getSettingsString(business?.settings, 'contact_form_id');
  const selectedContactFormSlug = getSettingsString(business?.settings, 'contact_form_slug');
  const configuredContactForm = selectedContactFormId
    ? await getActiveFormById(selectedContactFormId)
    : selectedContactFormSlug
      ? await getActiveFormBySlug(selectedContactFormSlug)
      : null;
  const businessId = business?.id ?? '';
  const location = [business?.city, business?.state, business?.zip].filter(Boolean).join(', ');
  const templateContent = toTemplatePageContent(page?.content);
  const templateHasHero = templateContent?.sections.some((section) => section.type === 'hero_standard') ?? false;
  const blocks = templateContent ? [] : toBlocks(page?.content);
  const configuredFields = toContactFormFields(configuredContactForm?.fields);

  return (
    <section className="page page--contact">
      {!templateHasHero && (
        <ContentPageHeader
          accent="Get In Touch"
          title={page?.title ?? 'Contact Us'}
          description={page?.meta_description ?? 'Tell us about your project and we will follow up with the next steps.'}
        />
      )}
      {(templateContent || blocks.length > 0) && (
        <div className="page__content">
          {templateContent ? <TemplatePageRenderer content={templateContent} /> : <BlockRenderer blocks={blocks} />}
        </div>
      )}
      <PageSection title="Form">
        <div className="contact__layout">
          <div className="contact__info">
            {business?.phone && (
              <p>
                <strong>Phone:</strong>{' '}
                <TrackedPhoneLink phone={business.phone} />
              </p>
            )}
            {business?.email && <p><strong>Email:</strong> {business.email}</p>}
            {(business?.address_line1 || location) && (
              <p>
                <strong>Address:</strong>{' '}
                {[business?.address_line1, business?.address_line2, location].filter(Boolean).join(', ')}
              </p>
            )}
            {business?.timezone && <p><strong>Timezone:</strong> {business.timezone}</p>}
          </div>
          {businessId ? (
            <ContactForm
              businessId={businessId}
              services={services.map((service) => ({ id: service.id, title: service.title }))}
              fields={configuredFields.length > 0 ? configuredFields : undefined}
              formId={configuredContactForm?.id ?? undefined}
            />
          ) : (
            <p>Contact form is unavailable right now.</p>
          )}
        </div>
      </PageSection>
    </section>
  );
}
