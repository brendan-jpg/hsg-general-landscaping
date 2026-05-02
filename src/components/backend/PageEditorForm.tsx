'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import EditorSaveButton from '@/components/backend/EditorSaveButton';
import { useRouter } from 'next/navigation';
import SeoFields from '@/components/backend/SeoFields';
import TemplatePageEditor from '@/components/backend/TemplatePageEditor';
import useDirtyState from '@/components/backend/useDirtyState';
import {
  convertBasicBlocksToTemplatePageContent,
  createTemplatePageContent,
  toTemplatePageContent,
  type TemplatePageContent,
} from '@/lib/sections/templatePages';
import type { SharedSectionComponent } from '@/lib/sections/sharedSections';
import { getRecommendedPageTemplateKeyForPageKind, getRecommendedPageTemplateKeyForSlug } from '@/lib/sections/templateOptions';
import { isPageKind, isProtectedPage } from '@/lib/content/pageConfig';
import { deletePage, savePage } from '@/lib/actions';
import type { Tables } from '@/lib/types/database';

type Page = Tables<'pages'>;

interface PageEditorFormProps {
  page: Page | null;
  formOptions?: Array<{ id: string; name: string; slug: string }>;
  sharedSections?: SharedSectionComponent[];
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function PageEditorForm({ page, formOptions = [], sharedSections: initialSharedSections = [] }: PageEditorFormProps) {
  const router = useRouter();
  const recommendedTemplateKey =
    getRecommendedPageTemplateKeyForPageKind(isPageKind(page?.page_kind) ? page.page_kind : null) ??
    getRecommendedPageTemplateKeyForSlug(page?.slug);
  const existingTemplateContent =
    toTemplatePageContent(page?.content) ??
    convertBasicBlocksToTemplatePageContent(page?.content, recommendedTemplateKey, page?.title || 'Overview');
  const defaultTemplateKey = existingTemplateContent?.templateKey ?? recommendedTemplateKey;
  const isProtectedSystemPage = isProtectedPage(page);
  const [title, setTitle] = useState(page?.title ?? '');
  const [slug, setSlug] = useState(page?.slug ?? '');
  const [slugEdited, setSlugEdited] = useState(Boolean(page?.slug));
  const [showInNav, setShowInNav] = useState(page?.show_in_nav ?? false);
  const [sortOrder, setSortOrder] = useState(String(page?.sort_order ?? 0));
  const [ogImageUrl, setOgImageUrl] = useState(page?.og_image_url ?? '');
  const [metaTitle, setMetaTitle] = useState(page?.meta_title ?? '');
  const [metaDescription, setMetaDescription] = useState(page?.meta_description ?? '');
  const [templateContent, setTemplateContent] = useState<TemplatePageContent>(() => {
    if (existingTemplateContent) return existingTemplateContent;
    return createTemplatePageContent(defaultTemplateKey);
  });
  const [sharedSections, setSharedSections] = useState<SharedSectionComponent[]>(initialSharedSections);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openTagMenu, setOpenTagMenu] = useState<'title' | 'slug' | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const slugInputRef = useRef<HTMLInputElement | null>(null);
  const titleMenuRef = useRef<HTMLDivElement | null>(null);
  const slugMenuRef = useRef<HTMLDivElement | null>(null);
  const pageFieldTags = useMemo(
    () =>
      Array.from(
        new Set([
          '{{business}}',
          '{{city}}',
          '{{state}}',
          '{{state_code}}',
          '{{primary_area}}',
          '{{primary_service}}',
          '{{page}}',
          '{{url}}',
          '{{site_url}}',
        ]),
      ),
    [],
  );
  const isDirty = useDirtyState({
    title,
    slug,
    showInNav,
    sortOrder,
    ogImageUrl,
    metaTitle,
    metaDescription,
    templateContent,
    sharedSections,
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (openTagMenu === 'title' && titleMenuRef.current && !titleMenuRef.current.contains(event.target as Node)) {
        setOpenTagMenu(null);
      }
      if (openTagMenu === 'slug' && slugMenuRef.current && !slugMenuRef.current.contains(event.target as Node)) {
        setOpenTagMenu(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openTagMenu]);

  function insertFieldTag(field: 'title' | 'slug', tag: string) {
    const input = field === 'title' ? titleInputRef.current : slugInputRef.current;
    const currentValue = field === 'title' ? title : slug;

    if (!input) {
      if (field === 'title') {
        setTitle((prev) => `${prev}${tag}`);
      } else {
        setSlugEdited(true);
        setSlug((prev) => `${prev}${tag}`);
      }
      setOpenTagMenu(null);
      return;
    }

    const start = input.selectionStart ?? currentValue.length;
    const end = input.selectionEnd ?? currentValue.length;
    const nextValue = `${currentValue.slice(0, start)}${tag}${currentValue.slice(end)}`;

    if (field === 'title') {
      setTitle(nextValue);
    } else {
      setSlugEdited(true);
      setSlug(nextValue);
    }
    setOpenTagMenu(null);

    requestAnimationFrame(() => {
      input.focus();
      const cursor = start + tag.length;
      input.setSelectionRange(cursor, cursor);
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      const formData = new FormData();
      if (page?.id) formData.set('id', page.id);

      formData.set('title', title);
      formData.set('slug', slug);
      if (!isProtectedSystemPage) {
        formData.set('sort_order', sortOrder);
      }
      formData.set('og_image_url', ogImageUrl);
      formData.set('meta_title', metaTitle);
      formData.set('meta_description', metaDescription);
      formData.set('content', JSON.stringify(templateContent));
      formData.set('shared_sections', JSON.stringify(sharedSections));
      if (!isProtectedSystemPage && showInNav) formData.set('show_in_nav', 'on');

      await savePage(formData);
      router.push('/dashboard/pages');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save page');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!page?.id) return;
    if (isProtectedSystemPage) {
      setError('This page cannot be deleted.');
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
        <div className="service-editor__title-row">
          <input
            ref={titleInputRef}
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
          <div className="seo-fields__token-menu" ref={titleMenuRef}>
            <button
              type="button"
              className="seo-fields__token-trigger"
              aria-label="Insert dynamic tag into title"
              onClick={() => setOpenTagMenu((current) => (current === 'title' ? null : 'title'))}
            >
              <BoltIcon />
            </button>
            {openTagMenu === 'title' && (
              <div className="seo-fields__token-dropdown">
                {pageFieldTags.map((tag) => (
                  <button
                    key={`page-title-${tag}`}
                    type="button"
                    className="seo-fields__token-option"
                    onClick={() => insertFieldTag('title', tag)}
                  >
                    <code>{tag}</code>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="service-editor__slug-row">
          <input
            ref={slugInputRef}
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
          <div className="seo-fields__token-menu" ref={slugMenuRef}>
            <button
              type="button"
              className="seo-fields__token-trigger"
              aria-label="Insert dynamic tag into slug"
              onClick={() => setOpenTagMenu((current) => (current === 'slug' ? null : 'slug'))}
            >
              <BoltIcon />
            </button>
            {openTagMenu === 'slug' && (
              <div className="seo-fields__token-dropdown">
                {pageFieldTags.map((tag) => (
                  <button
                    key={`page-slug-${tag}`}
                    type="button"
                    className="seo-fields__token-option"
                    onClick={() => insertFieldTag('slug', tag)}
                  >
                    <code>{tag}</code>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <TemplatePageEditor
          value={templateContent}
          sharedSections={sharedSections}
          dynamicSelectOptions={{
            contact_form_id: formOptions.map((form) => ({ value: form.id, label: `${form.name} (${form.slug})` })),
          }}
          onSharedSectionsChange={setSharedSections}
          onChange={(nextValue) => {
            setTemplateContent(nextValue);
          }}
        />
      </div>

      <aside className="editor__sidebar">
        {!isProtectedSystemPage && (
          <>
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
          </>
        )}
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
          <EditorSaveButton isDirty={isDirty} isSaving={isSaving} disabled={isSaving || isDeleting} />
          {page?.id && !isProtectedSystemPage && (
            <button className="btn" type="button" onClick={handleDelete} disabled={isSaving || isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </aside>
    </form>
  );
}

function BoltIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}


