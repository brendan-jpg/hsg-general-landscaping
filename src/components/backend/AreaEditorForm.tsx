'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import EditorSaveButton from '@/components/backend/EditorSaveButton';
import { useRouter } from 'next/navigation';
import IconValue, { isIconImageValue } from '@/components/shared/IconValue';
import MediaPickerField from '@/components/backend/MediaPickerField';
import SeoFields from '@/components/backend/SeoFields';
import TemplatePageEditor from '@/components/backend/TemplatePageEditor';
import useDirtyState from '@/components/backend/useDirtyState';
import EntityIcon, { ENTITY_ICON_OPTIONS } from '@/components/shared/EntityIcon';
import type { MediaUsageReference } from '@/lib/media/queries';
import {
  convertBasicBlocksToTemplatePageContent,
  createTemplatePageContent,
  toTemplatePageContent,
  type TemplatePageContent,
} from '@/lib/sections/templatePages';
import type { SharedSectionComponent } from '@/lib/sections/sharedSections';
import { deleteArea, saveArea } from '@/lib/actions';
import type { Tables } from '@/lib/types/database';

type Area = Tables<'areas'>;
type Media = Tables<'media'>;

interface AreaEditorFormProps {
  area: Area | null;
  businessId: string;
  mediaItems: Media[];
  mediaUsageByUrl?: Record<string, MediaUsageReference[]>;
  sharedSections?: SharedSectionComponent[];
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function AreaEditorForm({
  area,
  businessId,
  mediaItems,
  mediaUsageByUrl = {},
  sharedSections: initialSharedSections = [],
}: AreaEditorFormProps) {
  const router = useRouter();
  const fixedTemplateKey = 'area-content-v1';
  const existingTemplateContent =
    toTemplatePageContent(area?.content) ??
    convertBasicBlocksToTemplatePageContent(
      area?.content,
      fixedTemplateKey,
      `Services in ${area?.name || 'Area'}`,
    );
  const defaultTemplateKey =
    existingTemplateContent?.templateKey ??
    fixedTemplateKey;
  const [name, setName] = useState(area?.name ?? '');
  const [slug, setSlug] = useState(area?.slug ?? '');
  const [slugEdited, setSlugEdited] = useState(Boolean(area?.slug));
  const [icon, setIcon] = useState(area?.icon ?? '');
  const [featuredImageUrl, setFeaturedImageUrl] = useState(area?.featured_image_url ?? '');
  const [metaTitle, setMetaTitle] = useState(area?.meta_title ?? '');
  const [metaDescription, setMetaDescription] = useState(area?.meta_description ?? '');
  const [templateContent, setTemplateContent] = useState<TemplatePageContent>(() => {
    if (existingTemplateContent) return existingTemplateContent;
    return createTemplatePageContent(defaultTemplateKey);
  });
  const [sharedSections, setSharedSections] = useState<SharedSectionComponent[]>(initialSharedSections);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openTagMenu, setOpenTagMenu] = useState<'name' | 'slug' | null>(null);
  const iconPickerRef = useRef<HTMLDetailsElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const slugInputRef = useRef<HTMLInputElement | null>(null);
  const nameMenuRef = useRef<HTMLDivElement | null>(null);
  const slugMenuRef = useRef<HTMLDivElement | null>(null);

  const iconImageUrl = isIconImageValue(icon) ? icon : '';
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
          '{{area}}',
          '{{location}}',
          '{{service}}',
          '{{url}}',
          '{{site_url}}',
        ]),
      ),
    [],
  );
  const isDirty = useDirtyState({
    name,
    slug,
    icon,
    featuredImageUrl,
    metaTitle,
    metaDescription,
    templateContent,
    sharedSections,
  });

  useEffect(() => {
    function handleTagMenuClickOutside(event: MouseEvent) {
      if (openTagMenu === 'name' && nameMenuRef.current && !nameMenuRef.current.contains(event.target as Node)) {
        setOpenTagMenu(null);
      }
      if (openTagMenu === 'slug' && slugMenuRef.current && !slugMenuRef.current.contains(event.target as Node)) {
        setOpenTagMenu(null);
      }
    }

    function closeIconPicker() {
      iconPickerRef.current?.removeAttribute('open');
    }

    function handlePointerDown(event: PointerEvent) {
      const picker = iconPickerRef.current;
      if (!picker?.open) return;
      if (event.target instanceof Node && picker.contains(event.target)) return;
      closeIconPicker();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      closeIconPicker();
    }

    document.addEventListener('mousedown', handleTagMenuClickOutside);
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleTagMenuClickOutside);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openTagMenu]);

  function insertFieldTag(field: 'name' | 'slug', tag: string) {
    const input = field === 'name' ? nameInputRef.current : slugInputRef.current;
    const currentValue = field === 'name' ? name : slug;

    if (!input) {
      if (field === 'name') {
        setName((prev) => `${prev}${tag}`);
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

    if (field === 'name') {
      setName(nextValue);
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
      if (area?.id) formData.set('id', area.id);
      if (businessId) formData.set('business_id', businessId);
      formData.set('name', name);
      formData.set('slug', slug);
      formData.set('icon', icon);
      formData.set('featured_image_url', featuredImageUrl);
      formData.set('meta_title', metaTitle);
      formData.set('meta_description', metaDescription);
      formData.set('content', JSON.stringify(templateContent));
      formData.set('shared_sections', JSON.stringify(sharedSections));

      await saveArea(formData);
      router.push('/dashboard/areas');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save area');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!area?.id) return;
    if (!window.confirm('Delete this area? This cannot be undone.')) return;

    setError(null);
    setIsDeleting(true);
    try {
      await deleteArea(area.id);
      router.push('/dashboard/areas');
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete area');
      setIsDeleting(false);
    }
  }

  return (
    <form className="editor" onSubmit={handleSubmit}>
      <div className="editor__main">
        <div className="service-editor__title-row">
          <input
            ref={nameInputRef}
            className="editor__title-input"
            type="text"
            placeholder="Area name"
            value={name}
            onChange={(event) => {
              const nextName = event.target.value;
              setName(nextName);
              if (!slugEdited) setSlug(slugify(nextName));
            }}
            required
          />
          <details ref={iconPickerRef} className="service-icon-picker service-icon-picker--inline">
            <summary className="service-icon-picker__trigger" aria-label="Choose area icon">
              <span className={`service-icon-picker__btn ${icon ? 'service-icon-picker__btn--active' : ''}`}>
                {icon ? (
                  <IconValue value={icon} imageClassName="service-icon-picker__image" />
                ) : (
                  <span aria-hidden="true">-</span>
                )}
              </span>
            </summary>
            <div className="service-icon-picker__menu" role="group" aria-label="Area icon options">
              <button
                type="button"
                className={`service-icon-picker__btn ${!icon ? 'service-icon-picker__btn--active' : ''}`}
                onClick={() => {
                  setIcon('');
                  iconPickerRef.current?.removeAttribute('open');
                }}
                aria-label="No icon"
                title="No icon"
              >
                <span aria-hidden="true">-</span>
              </button>
              <MediaPickerField
                className="service-icon-picker__media-field"
                label="Icon Image"
                value={iconImageUrl}
                onChange={(nextValue) => {
                  setIcon(nextValue.trim());
                  iconPickerRef.current?.removeAttribute('open');
                }}
                mediaTab="icon"
                allowUpload
                uploadRole="icon"
                maxUploadFiles={1}
                showSelectedActions={false}
                hideLabel
                hidePlaceholderText
              />
              {ENTITY_ICON_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`service-icon-picker__btn ${icon === option.value ? 'service-icon-picker__btn--active' : ''}`}
                  onClick={() => {
                    setIcon(option.value);
                    iconPickerRef.current?.removeAttribute('open');
                  }}
                  aria-label={option.label}
                  title={option.label}
                >
                  <EntityIcon name={option.value} />
                </button>
              ))}
            </div>
          </details>
          <div className="seo-fields__token-menu" ref={nameMenuRef}>
            <button
              type="button"
              className="seo-fields__token-trigger"
              aria-label="Insert dynamic tag into area name"
              onClick={() => setOpenTagMenu((current) => (current === 'name' ? null : 'name'))}
            >
              <BoltIcon />
            </button>
            {openTagMenu === 'name' && (
              <div className="seo-fields__token-dropdown">
                {fieldTags.map((tag) => (
                  <button
                    key={`area-name-${tag}`}
                    type="button"
                    className="seo-fields__token-option"
                    onClick={() => insertFieldTag('name', tag)}
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
            placeholder="area-slug"
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
                    key={`area-slug-${tag}`}
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
          className="area-editor__featured-image-field"
          label="Image"
          value={featuredImageUrl}
          onChange={setFeaturedImageUrl}
          items={mediaItems}
          usageByUrl={mediaUsageByUrl}
          allowUpload
          maxUploadFiles={1}
          hidePlaceholderText
        />
        <SeoFields
          metaTitle={metaTitle}
          metaDescription={metaDescription}
          mediaItems={mediaItems}
          mediaUsageByUrl={mediaUsageByUrl}
          availableTags={['{{area}}', '{{location}}', '{{service}}']}
          onChange={(field, value) => {
            if (field === 'meta_title') setMetaTitle(value);
            if (field === 'meta_description') setMetaDescription(value);
          }}
        />
        {error && <p className="form-error">{error}</p>}
        <div className="editor__field-group">
          <EditorSaveButton isDirty={isDirty} isSaving={isSaving} disabled={isSaving || isDeleting} />
          {area?.id && (
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

