import type { TemplatePageContent } from './templatePages';
import RenderedSection from './template-renderer/renderedSection';
import {
  defaultTemplatePageRendererAdapter,
  type TemplatePageRenderContext,
  type TemplatePageRendererAdapter,
} from './template-renderer/shared';

interface TemplatePageRendererProps {
  content: TemplatePageContent;
  context?: TemplatePageRenderContext;
  adapter?: TemplatePageRendererAdapter;
}

export default async function TemplatePageRenderer({
  content,
  context,
  adapter = defaultTemplatePageRendererAdapter,
}: TemplatePageRendererProps) {
  const firstVisibleSectionIndex = content.sections.findIndex((section) => section.hidden !== true);
  return (
    <>
      {content.sections.map((section, index) => (
        <RenderedSection
          key={section.id}
          section={section}
          context={context}
          adapter={adapter}
          isFirstSection={index === firstVisibleSectionIndex}
        />
      ))}
    </>
  );
}

export type { TemplatePageRenderContext, TemplatePageRendererAdapter };
