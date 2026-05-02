import type { TemplatePageContent, TemplateSectionInstance } from '@/lib/content/templatePages';

interface TemplatePageRendererProps {
  content: TemplatePageContent;
}

export default function TemplatePageRenderer({ content }: TemplatePageRendererProps) {
  return (
    <div className="template-page-renderer">
      {content.sections.map((section) => (
        <RenderedSection key={section.id} section={section} />
      ))}
    </div>
  );
}

function RenderedSection({ section }: { section: TemplateSectionInstance }) {
  if (section.hidden) return null;

  const data = section.data as Record<string, unknown>;
  const getString = (value: unknown) => (typeof value === 'string' ? value : '');
  const getObject = (value: unknown) =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

  switch (section.type) {
    case 'hero_standard': {
      const cta = getObject(data.primaryCta);
      const ctaText = getString(cta.text);
      const ctaHref = getString(cta.href);
      return (
        <section className="template-section template-section--hero">
          {getString(data.headline) && <h2>{getString(data.headline)}</h2>}
          {getString(data.body) && <p>{getString(data.body)}</p>}
          {ctaText && ctaHref && (
            <p>
              <a href={ctaHref} className="btn btn--primary">
                {ctaText}
              </a>
            </p>
          )}
        </section>
      );
    }

    case 'rich_text_section':
      return (
        <section className="template-section template-section--content">
          {getString(data.heading) && <h2>{getString(data.heading)}</h2>}
          {getString(data.body) &&
            getString(data.body)
              .split(/\n{2,}/)
              .map((paragraph, index) => (
                <p key={index}>{paragraph.trim()}</p>
              ))}
        </section>
      );

    case 'faq_list': {
      const items = Array.isArray(data.items)
        ? data.items.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && !Array.isArray(item))
        : [];
      if (items.length === 0 && !getString(data.heading)) return null;

      return (
        <section className="template-section template-section--faq">
          {getString(data.heading) && <h2>{getString(data.heading)}</h2>}
          <div>
            {items.map((item, index) => {
              const question = getString(item.question);
              const answer = getString(item.answer);
              if (!question && !answer) return null;
              return (
                <div key={index}>
                  {question && <h3>{question}</h3>}
                  {answer && <p>{answer}</p>}
                </div>
              );
            })}
          </div>
        </section>
      );
    }

    case 'cta_band': {
      const cta = getObject(data.cta);
      const ctaText = getString(cta.text);
      const ctaHref = getString(cta.href);
      return (
        <section className="template-section template-section--cta">
          {getString(data.heading) && <h2>{getString(data.heading)}</h2>}
          {getString(data.body) && <p>{getString(data.body)}</p>}
          {ctaText && ctaHref && (
            <p>
              <a href={ctaHref} className="btn btn--primary">
                {ctaText}
              </a>
            </p>
          )}
        </section>
      );
    }

    default:
      return null;
  }
}
