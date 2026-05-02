'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import BlockEditor from '@/components/backend/BlockEditor';
import MediaPickerField from '@/components/backend/MediaPickerField';
import SeoFields from '@/components/backend/SeoFields';
import TemplatePageEditor from '@/components/backend/TemplatePageEditor';
import {
  createTemplatePageContent,
  listPageTemplates,
  sanitizeTemplatePageContent,
  toTemplatePageContent,
  type TemplatePageContent,
} from '@/lib/content/templatePages';
import { deleteArea, saveArea } from '@/lib/actions';
import type { Tables } from '@/lib/types/database';

interface Block {
  type: string;
  data: Record<string, unknown>;
}

type Area = Tables<'service_areas'>;

interface AreaEditorFormProps {
  area: Area | null;
  serviceOptions: Array<{ id: string; title: string }>;
  linkedServiceIds: string[];
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

export default function AreaEditorForm({
  area,
  serviceOptions,
  linkedServiceIds,
}: AreaEditorFormProps) {
  const router = useRouter();
  const existingTemplateContent = toTemplatePageContent(area?.content);
  const templateOptions = listPageTemplates().filter((template) =>
    ['area-content-v1', 'service-content-v1'].includes(template.key),
  );
  const defaultTemplateKey =
    existingTemplateContent?.templateKey ??
    templateOptions.find((template) => template.key === 'area-content-v1')?.key ??
    templateOptions[0]?.key ??
    'area-content-v1';
  const [name, setName] = useState(area?.name ?? '');
  const [slug, setSlug] = useState(area?.slug ?? '');
  const [slugEdited, setSlugEdited] = useState(Boolean(area?.slug));
  const [featuredImageUrl, setFeaturedImageUrl] = useState(area?.featured_image_url ?? '');
  const [metaTitle, setMetaTitle] = useState(area?.meta_title ?? '');
  const [metaDescription, setMetaDescription] = useState(area?.meta_description ?? '');
  const [contentMode, setContentMode] = useState<'blocks' | 'template'>(existingTemplateContent ? 'template' : 'blocks');
  const [templateKey, setTemplateKey] = useState(defaultTemplateKey);
  const [templateContent, setTemplateContent] = useState<TemplatePageContent>(() => {
    if (existingTemplateContent) return existingTemplateContent;
    return createTemplatePageContent(defaultTemplateKey);
  });
  const [blocks, setBlocks] = useState<Block[]>(() => toBlocks(area?.content));
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(
    () => (area ? linkedServiceIds : serviceOptions.map((service) => service.id)),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedServiceIdsSet = useMemo(() => new Set(selectedServiceIds), [selectedServiceIds]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const formData = new FormData();
      if (area?.id) formData.set('id', area.id);
      formData.set('name', name);
      formData.set('slug', slug);
      formData.set('featured_image_url', featuredImageUrl);
      formData.set('meta_title', metaTitle);
      formData.set('meta_description', metaDescription);
      formData.set('content', JSON.stringify(contentMode === 'template' ? templateContent : blocks));
      formData.set('linked_service_ids', JSON.stringify(selectedServiceIds));

      await saveArea(formData);
      router.push('/dashboard/areas');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save Area');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!area?.id) return;
    if (!window.confirm('Delete this Area? This cannot be undone.')) return;

    setError(null);
    setIsDeleting(true);
    try {
      await deleteArea(area.id);
      router.push('/dashboard/areas');
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete Area');
      setIsDeleting(false);
    }
  }

  return (
    <form className="editor" onSubmit={handleSubmit}>
      <div className="editor__main">
        <input
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
        <input
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
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: contentMode === 'template' ? '1fr 1fr' : '1fr',
            gap: '0.75rem',
            alignItems: 'start',
          }}
        >
          <div className="editor__field-group">
            <label>Content Model</label>
            <select
              value={contentMode}
              onChange={(event) => {
                const nextMode = event.target.value as 'blocks' | 'template';
                setContentMode(nextMode);
                if (nextMode === 'template') {
                  setTemplateContent((current) =>
                    current.templateKey === templateKey ? current : createTemplatePageContent(templateKey),
                  );
                }
              }}
            >
              <option value="template">Template Sections (recommended)</option>
              <option value="blocks">Legacy Blocks</option>
            </select>
          </div>
          {contentMode === 'template' && (
            <div className="editor__field-group">
              <label>Template</label>
              <select
                value={templateKey}
                onChange={(event) => {
                  const nextTemplateKey = event.target.value;
                  setTemplateKey(nextTemplateKey);
                  setTemplateContent((current) =>
                    current.templateKey === nextTemplateKey ? current : createTemplatePageContent(nextTemplateKey),
                  );
                }}
              >
                {templateOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
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
        <MediaPickerField
          label="Image"
          value={featuredImageUrl}
          onChange={setFeaturedImageUrl}
        />
        <div className="editor__field-group">
          <label>Linked Services</label>
          {serviceOptions.length > 0 && (
            <div className="media-picker__controls">
              <button
                className="btn"
                type="button"
                onClick={() => setSelectedServiceIds(serviceOptions.map((service) => service.id))}
              >
                Select All
              </button>
              <button className="btn" type="button" onClick={() => setSelectedServiceIds([])}>
                Clear
              </button>
            </div>
          )}
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
          availableTags={['{{area}}', '{{location}}', '{{service}}']}
          onChange={(field, value) => {
            if (field === 'meta_title') setMetaTitle(value);
            if (field === 'meta_description') setMetaDescription(value);
          }}
        />
        {error && <p className="form-error">{error}</p>}
        <div className="editor__field-group">
          <button className="btn btn--primary" type="submit" disabled={isSaving || isDeleting}>
            {isSaving ? 'Saving...' : 'Save'}
          </button>
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
