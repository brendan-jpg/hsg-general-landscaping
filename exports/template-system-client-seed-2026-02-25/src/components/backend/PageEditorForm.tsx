'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import BlockEditor from '@/components/backend/BlockEditor';
import SeoFields from '@/components/backend/SeoFields';
import TemplatePageEditor from '@/components/backend/TemplatePageEditor';
import {
  createTemplatePageContent,
  listPageTemplates,
  sanitizeTemplatePageContent,
  toTemplatePageContent,
  type TemplatePageContent,
} from '@/lib/content/templatePages';
import { deletePage, savePage } from '@/lib/actions';
import type { Tables } from '@/lib/types/database';

interface Block {
  type: string;
  data: Record<string, unknown>;
}

type Page = Tables<'pages'>;

interface PageEditorFormProps {
  page: Page | null;
}

function toBlocks(content: unknown): Block[] {
  if (!Array.isArray(content)) return [];
  return content.filter((value): value is Block => {
    if (!value || typeof value !== 'object') return false;
    const block = value as Block;
    return typeof block.type === 'string' && !!block.data && typeof block.data === 'object';
  });
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getRecommendedPageTemplateKey(slugValue: string | null | undefined) {
  if (slugValue === 'about') return 'about-page-v1';
  if (slugValue === 'contact') return 'contact-page-v1';
  return 'content-page-v1';
}

export default function PageEditorForm({ page }: PageEditorFormProps) {
  const router = useRouter();
  const existingTemplateContent = toTemplatePageContent(page?.content);
  const templateOptions = listPageTemplates().filter((template) =>
    ['content-page-v1', 'about-page-v1', 'contact-page-v1'].includes(template.key),
  );
  const recommendedTemplateKey = getRecommendedPageTemplateKey(page?.slug);
  const defaultTemplateKey =
    existingTemplateContent?.templateKey ??
    templateOptions.find((template) => template.key === recommendedTemplateKey)?.key ??
    templateOptions[0]?.key ??
    'content-page-v1';
  const isProtectedHomePage = page?.slug === 'home';
  const [title, setTitle] = useState(page?.title ?? '');
  const [slug, setSlug] = useState(page?.slug ?? '');
  const [slugEdited, setSlugEdited] = useState(Boolean(page?.slug));
  const [showInNav, setShowInNav] = useState(page?.show_in_nav ?? false);
  const [sortOrder, setSortOrder] = useState(String(page?.sort_order ?? 0));
  const [ogImageUrl, setOgImageUrl] = useState(page?.og_image_url ?? '');
  const [metaTitle, setMetaTitle] = useState(page?.meta_title ?? '');
  const [metaDescription, setMetaDescription] = useState(page?.meta_description ?? '');
  const [contentMode, setContentMode] = useState<'blocks' | 'template'>(existingTemplateContent ? 'template' : 'blocks');
  const [templateKey, setTemplateKey] = useState(defaultTemplateKey);
  const [templateContent, setTemplateContent] = useState<TemplatePageContent>(() => {
    if (existingTemplateContent) return existingTemplateContent;
    return createTemplatePageContent(defaultTemplateKey);
  });
  const [blocks, setBlocks] = useState<Block[]>(() => toBlocks(page?.content));
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      const formData = new FormData();
      if (page?.id) formData.set('id', page.id);

      formData.set('title', title);
      formData.set('slug', slug);
      formData.set('sort_order', sortOrder);
      formData.set('og_image_url', ogImageUrl);
      formData.set('meta_title', metaTitle);
      formData.set('meta_description', metaDescription);
      const contentPayload = contentMode === 'template' ? templateContent : blocks;
      formData.set('content', JSON.stringify(contentPayload));
      if (showInNav) formData.set('show_in_nav', 'on');

      const result = await savePage(formData);
      router.replace(`/dashboard/pages/${result.id}`);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save page');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!page?.id) return;
    if (isProtectedHomePage) {
      setError('The Home page cannot be deleted.');
      return;
    }
    if (!window.confirm('Delete this page? This cannot be undone.')) return;

    setError(null);
    setIsDeleting(true);
    try {
      await deletePage(page.id);
      router.push('/dashboard/pages');
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete page');
      setIsDeleting(false);
    }
  }

  return (
    <form className="editor" onSubmit={handleSubmit}>
      <div className="editor__main">
        <input
          className="editor__title-input"
          type="text"
          placeholder="Page title"
          value={title}
          onChange={(event) => {
            const nextTitle = event.target.value;
            setTitle(nextTitle);
            if (!slugEdited) setSlug(slugify(nextTitle));
          }}
          required
        />
        <input
          className="editor__slug-input"
          type="text"
          placeholder="page-slug"
          value={slug}
          onChange={(event) => {
            setSlugEdited(true);
            setSlug(event.target.value);
          }}
          required
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: contentMode === 'template' ? '1fr 1fr' : '1fr',
            gap: '0.75rem',
            alignItems: 'start',
          }}
        >
          <div className="editor__field-group">
            <label>Page Content Model</label>
            <select
              value={contentMode}
              onChange={(event) => {
                const nextMode = event.target.value as 'blocks' | 'template';
                setContentMode(nextMode);
                if (nextMode === 'template') {
                  setTemplateContent((current) => {
                    if (current.templateKey === templateKey) return current;
                    return createTemplatePageContent(templateKey);
                  });
                }
              }}
            >
              <option value="template">Template Sections (recommended)</option>
              <option value="blocks">Legacy Blocks</option>
            </select>
          </div>
          {contentMode === 'template' && (
            <div className="editor__field-group">
              <label>Page Template</label>
              <select
                value={templateKey}
                onChange={(event) => {
                  const nextTemplateKey = event.target.value;
                  setTemplateKey(nextTemplateKey);
                  setTemplateContent((current) => {
                    if (current.templateKey === nextTemplateKey) return current;
                    try {
                      return createTemplatePageContent(nextTemplateKey);
                    } catch {
                      return current;
                    }
                  });
                }}
              >
                {templateOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
              <small>Clients edit content only. Layout/styles stay locked to the selected template.</small>
            </div>
          )}
        </div>
        {contentMode === 'template' ? (
          <>
            <TemplatePageEditor
              value={templateContent}
              onChange={(nextValue) => {
                try {
                  const sanitized = sanitizeTemplatePageContent(nextValue);
                  setTemplateKey(sanitized.templateKey);
                  setTemplateContent(sanitized);
                } catch {
                  setTemplateContent(nextValue);
                }
              }}
            />
          </>
        ) : (
          <BlockEditor blocks={blocks} onChange={setBlocks} />
        )}
      </div>

      <aside className="editor__sidebar">
        <div className="editor__field-group">
          <label>Show in Nav</label>
          <input
            type="checkbox"
            checked={showInNav}
            onChange={(event) => setShowInNav(event.target.checked)}
          />
        </div>
        <div className="editor__field-group">
          <label>Sort Order</label>
          <input type="number" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} />
        </div>
        <SeoFields
          metaTitle={metaTitle}
          metaDescription={metaDescription}
          ogImageUrl={ogImageUrl}
          availableTags={['{{page}}']}
          onChange={(field, value) => {
            if (field === 'meta_title') setMetaTitle(value);
            if (field === 'meta_description') setMetaDescription(value);
            if (field === 'og_image_url') setOgImageUrl(value);
          }}
        />
        {error && <p className="form-error">{error}</p>}
        <div className="editor__field-group">
          <button className="btn btn--primary" type="submit" disabled={isSaving || isDeleting}>
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          {page?.id && !isProtectedHomePage && (
            <button className="btn" type="button" onClick={handleDelete} disabled={isSaving || isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </aside>
    </form>
  );
}
