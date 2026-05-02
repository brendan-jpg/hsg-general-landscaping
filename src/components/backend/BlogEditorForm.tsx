'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import EditorSaveButton from '@/components/backend/EditorSaveButton';
import { useRouter } from 'next/navigation';
import MediaPickerField from '@/components/backend/MediaPickerField';
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
import { deleteBlogPost, saveBlogPost } from '@/lib/actions';
import type { Tables } from '@/lib/types/database';

type BlogPost = Tables<'blog_posts'>;

interface BlogEditorFormProps {
  post: BlogPost | null;
  serviceOptions: Array<{ id: string; title: string }>;
  linkedServiceIds: string[];
  sharedSections?: SharedSectionComponent[];
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function BlogEditorForm({
  post,
  serviceOptions,
  linkedServiceIds,
  sharedSections: initialSharedSections = [],
}: BlogEditorFormProps) {
  const router = useRouter();
  const existingTemplateContent =
    toTemplatePageContent(post?.content) ??
    convertBasicBlocksToTemplatePageContent(post?.content, 'blog-post-content-v1', post?.title || 'Article');
  const [title, setTitle] = useState(post?.title ?? '');
  const [slug, setSlug] = useState(post?.slug ?? '');
  const [slugEdited, setSlugEdited] = useState(Boolean(post?.slug));
  const [excerpt] = useState(post?.excerpt ?? '');
  const [featuredImageUrl, setFeaturedImageUrl] = useState(post?.featured_image_url ?? '');
  const [status, setStatus] = useState(post?.status ?? 'draft');
  const [metaTitle, setMetaTitle] = useState(post?.meta_title ?? '');
  const [metaDescription, setMetaDescription] = useState(post?.meta_description ?? '');
  const [templateContent, setTemplateContent] = useState<TemplatePageContent>(() =>
    existingTemplateContent ?? createTemplatePageContent('blog-post-content-v1'),
  );
  const [sharedSections, setSharedSections] = useState<SharedSectionComponent[]>(initialSharedSections);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(linkedServiceIds);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedServiceIdsSet = useMemo(() => new Set(selectedServiceIds), [selectedServiceIds]);
  const [openTagMenu, setOpenTagMenu] = useState<'title' | 'slug' | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const slugInputRef = useRef<HTMLInputElement | null>(null);
  const titleMenuRef = useRef<HTMLDivElement | null>(null);
  const slugMenuRef = useRef<HTMLDivElement | null>(null);
  const fieldTags = useMemo(
    () =>
      Array.from(
        new Set([
          '{{business}}',
          '{{city}}',
          '{{state}}',
          '{{state_code}}',
          '{{primary_area}}',
          '{{primary_service}}',
          '{{post}}',
          '{{blog_post}}',
          '{{service}}',
          '{{url}}',
          '{{site_url}}',
        ]),
      ),
    [],
  );
  const isDirty = useDirtyState({
    title,
    slug,
    excerpt,
    featuredImageUrl,
    status,
    metaTitle,
    metaDescription,
    templateContent,
    selectedServiceIds,
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
      if (post?.id) formData.set('id', post.id);
      formData.set('title', title);
      formData.set('slug', slug);
      formData.set('excerpt', excerpt);
      formData.set('featured_image_url', featuredImageUrl);
      formData.set('status', status);
      formData.set('meta_title', metaTitle);
      formData.set('meta_description', metaDescription);
      formData.set('content', JSON.stringify(templateContent));
      formData.set('shared_sections', JSON.stringify(sharedSections));
      formData.set('linked_service_ids', JSON.stringify(selectedServiceIds));

      await saveBlogPost(formData);
      router.push('/dashboard/content?tab=blogs');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save blog post');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!post?.id) return;
    if (!window.confirm('Delete this post? This cannot be undone.')) return;

    setError(null);
    setIsDeleting(true);
    try {
      await deleteBlogPost(post.id);
      router.push('/dashboard/content?tab=blogs');
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete post');
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
            placeholder="Post title"
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
                {fieldTags.map((tag) => (
                  <button
                    key={`blog-title-${tag}`}
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
            placeholder="post-slug"
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
                {fieldTags.map((tag) => (
                  <button
                    key={`blog-slug-${tag}`}
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
          currentFeaturedImageUrl={featuredImageUrl}
          onSharedSectionsChange={setSharedSections}
          onChange={(nextValue) => {
            setTemplateContent(nextValue);
          }}
        />
      </div>
      <aside className="editor__sidebar">
        <MediaPickerField
          label="Image"
          value={featuredImageUrl}
          onChange={setFeaturedImageUrl}
          showChangeAction={false}
          selectedThumbAspect="square"
        />
        <div className="editor__field-group">
          <label>Status</label>
          <select value={status} onChange={(event) => setStatus(event.target.value as BlogPost['status'])}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="scheduled">Scheduled</option>
          </select>
        </div>
        <div className="editor__field-group">
          <label>Linked Services (Optional)</label>
          {serviceOptions.length === 0 ? (
            <p>No services available yet.</p>
          ) : (
            serviceOptions.map((service) => (
              <label key={service.id}>
                <input
                  type="checkbox"
                  checked={selectedServiceIdsSet.has(service.id)}
                  onChange={(event) => {
                    setSelectedServiceIds((current) => {
                      if (event.target.checked) return [...current, service.id];
                      return current.filter((id) => id !== service.id);
                    });
                  }}
                />
                {service.title}
              </label>
            ))
          )}
        </div>
        <SeoFields
          metaTitle={metaTitle}
          metaDescription={metaDescription}
          availableTags={['{{post}}', '{{blog_post}}']}
          onChange={(field, value) => {
            if (field === 'meta_title') setMetaTitle(value);
            if (field === 'meta_description') setMetaDescription(value);
          }}
        />
        {error && <p className="form-error">{error}</p>}
        <div className="editor__field-group">
          <EditorSaveButton isDirty={isDirty} isSaving={isSaving} disabled={isSaving || isDeleting} />
          {post?.id && (
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


