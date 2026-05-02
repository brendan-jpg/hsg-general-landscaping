'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import BlockEditor from '@/components/backend/BlockEditor';
import CollapseCaretToggle from '@/components/backend/CollapseCaretToggle';
import MediaGrid from '@/components/backend/MediaGrid';
import MediaPickerField from '@/components/backend/MediaPickerField';
import SeoFields from '@/components/backend/SeoFields';
import TemplatePageEditor from '@/components/backend/TemplatePageEditor';
import DeleteIcon from '@/components/shared/icons/DeleteIcon';
import EditIcon from '@/components/shared/icons/EditIcon';
import ServiceIcon, { SERVICE_ICON_OPTIONS, isServiceIconKey } from '@/components/shared/ServiceIcon';
import {
  createTemplatePageContent,
  listPageTemplates,
  sanitizeTemplatePageContent,
  toTemplatePageContent,
  type TemplatePageContent,
} from '@/lib/content/templatePages';
import { deleteService, saveService } from '@/lib/actions';
import type { Tables } from '@/lib/types/database';

interface Block {
  type: string;
  data: Record<string, unknown>;
}

interface ServiceProjectDraft {
  id: string;
  title: string;
  summary: string;
  photoUrls: string[];
  AreaIds: string[];
}

interface BeforeAfterGroupDraft {
  beforeUrls: string[];
  afterUrls: string[];
}

type Service = Tables<'services'>;
type Media = Tables<'media'>;

interface ServiceEditorFormProps {
  service: Service | null;
  mediaItems: Media[];
  serviceOptions?: Array<{ id: string; title: string }>;
  AreaOptions?: Array<{ id: string; name: string }>;
}

function toBlocks(content: unknown): Block[] {
  if (!Array.isArray(content)) return [];
  return content.filter((value): value is Block => {
    if (!value || typeof value !== 'object') return false;
    const block = value as Block;
    return typeof block.type === 'string' && typeof block.data === 'object' && !!block.data;
  });
}

function toNumberValue(value: number | null | undefined) {
  return value === null || value === undefined ? '' : String(value);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
}

function createDraftId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeBeforeAfterGroup(value: unknown): BeforeAfterGroupDraft | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const beforeUrls = toStringArray(row.before_urls);
  const afterUrls = toStringArray(row.after_urls);
  if (beforeUrls.length === 0 && afterUrls.length === 0) return null;
  return { beforeUrls, afterUrls };
}

function toBeforeAfterGroupDrafts(value: unknown, legacyBefore: unknown, legacyAfter: unknown): BeforeAfterGroupDraft[] {
  if (Array.isArray(value)) {
    const parsed = value.map(normalizeBeforeAfterGroup).filter((item): item is BeforeAfterGroupDraft => Boolean(item));
    if (parsed.length > 0) return parsed;
  }

  const beforeUrls = toStringArray(legacyBefore);
  const afterUrls = toStringArray(legacyAfter);
  return Array.from({ length: Math.max(beforeUrls.length, afterUrls.length) }, (_, index) => ({
    beforeUrls: beforeUrls[index] ? [beforeUrls[index]] : [],
    afterUrls: afterUrls[index] ? [afterUrls[index]] : [],
  })).filter((group) => group.beforeUrls.length > 0 || group.afterUrls.length > 0);
}

function toServiceProjectDrafts(value: unknown): ServiceProjectDraft[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const row = item as Record<string, unknown>;
      return {
        id: createDraftId(),
        title: typeof row.title === 'string' ? row.title : '',
        summary: typeof row.summary === 'string' ? row.summary : '',
        photoUrls: toStringArray(row.photo_urls),
        AreaIds: toStringArray(row.service_area_ids),
      };
    })
    .filter((item): item is ServiceProjectDraft => Boolean(item));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type PickerTarget =
  | { kind: 'beforeAfterBucket'; groupIndex: number; side: 'before' | 'after' }
  | { kind: 'project'; projectId: string }
  | null;

export default function ServiceEditorForm({
  service,
  mediaItems,
  serviceOptions = [],
  AreaOptions = [],
}: ServiceEditorFormProps) {
  const router = useRouter();
  const existingTemplateContent = toTemplatePageContent(service?.content);
  const templateOptions = listPageTemplates().filter((template) =>
    ['service-content-v1', 'area-content-v1'].includes(template.key),
  );
  const defaultTemplateKey =
    existingTemplateContent?.templateKey ??
    templateOptions.find((template) => template.key === 'service-content-v1')?.key ??
    templateOptions[0]?.key ??
    'service-content-v1';

  const [title, setTitle] = useState(service?.title ?? '');
  const [slug, setSlug] = useState(service?.slug ?? '');
  const [excerpt, setExcerpt] = useState(service?.excerpt ?? '');
  const [icon, setIcon] = useState(service?.icon ?? '');
  const [parentServiceId, setParentServiceId] = useState(service?.parent_service_id ?? '');
  const [featuredImageUrl, setFeaturedImageUrl] = useState(service?.featured_image_url ?? '');
  const [priceRangeMin, setPriceRangeMin] = useState(toNumberValue(service?.price_range_min));
  const [priceRangeMax, setPriceRangeMax] = useState(toNumberValue(service?.price_range_max));
  const [sortOrder, setSortOrder] = useState(toNumberValue(service?.sort_order ?? 0));
  const [metaTitle, setMetaTitle] = useState(service?.meta_title ?? '');
  const [metaDescription, setMetaDescription] = useState(service?.meta_description ?? '');
  const [contentMode, setContentMode] = useState<'blocks' | 'template'>(existingTemplateContent ? 'template' : 'blocks');
  const [templateKey, setTemplateKey] = useState(defaultTemplateKey);
  const [templateContent, setTemplateContent] = useState<TemplatePageContent>(() => {
    if (existingTemplateContent) return existingTemplateContent;
    return createTemplatePageContent(defaultTemplateKey);
  });
  const [blocks, setBlocks] = useState<Block[]>(() => toBlocks(service?.content));
  const [beforeAfterGroups, setBeforeAfterGroups] = useState<BeforeAfterGroupDraft[]>(
    () => toBeforeAfterGroupDrafts(service?.before_after_groups, service?.before_gallery_urls, service?.after_gallery_urls),
  );
  const [serviceProjects, setServiceProjects] = useState<ServiceProjectDraft[]>(
    () => toServiceProjectDrafts(service?.service_projects),
  );
  const [collapsedBeforeAfterGroupIndexes, setCollapsedBeforeAfterGroupIndexes] = useState<number[]>(() =>
    Array.from(
      { length: toBeforeAfterGroupDrafts(service?.before_after_groups, service?.before_gallery_urls, service?.after_gallery_urls).length },
      (_, index) => index,
    ),
  );
  const [collapsedProjectIds, setCollapsedProjectIds] = useState<string[]>(() =>
    serviceProjects.map((project) => project.id),
  );
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const [mediaSearch, setMediaSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugEdited, setSlugEdited] = useState(Boolean(service?.slug));
  const iconPickerRef = useRef<HTMLDetailsElement | null>(null);

  const isNew = !service?.id;
  const formId = useMemo(() => 'service-editor-form', []);
  const imageMediaItems = useMemo(
    () => mediaItems.filter((item) => item.file_type.startsWith('image/')),
    [mediaItems],
  );
  const filteredMediaItems = useMemo(() => {
    const query = mediaSearch.trim().toLowerCase();
    if (!query) return imageMediaItems;
    return imageMediaItems.filter((item) => item.file_name.toLowerCase().includes(query));
  }, [imageMediaItems, mediaSearch]);
  const collapsedProjectIdSet = useMemo(() => new Set(collapsedProjectIds), [collapsedProjectIds]);
  const collapsedBeforeAfterGroupIndexSet = useMemo(
    () => new Set(collapsedBeforeAfterGroupIndexes),
    [collapsedBeforeAfterGroupIndexes],
  );
  const pickerSelectedUrls = useMemo(() => {
    if (!pickerTarget) return [];
    if (pickerTarget.kind === 'beforeAfterBucket') {
      const group = beforeAfterGroups[pickerTarget.groupIndex];
      if (!group) return [];
      return pickerTarget.side === 'before' ? group.beforeUrls : group.afterUrls;
    }
    return serviceProjects.find((project) => project.id === pickerTarget.projectId)?.photoUrls ?? [];
  }, [beforeAfterGroups, pickerTarget, serviceProjects]);
  const pickerSelectedUrlSet = useMemo(() => new Set(pickerSelectedUrls), [pickerSelectedUrls]);
  const pickerSelectedMediaIds = useMemo(
    () => imageMediaItems.filter((item) => pickerSelectedUrlSet.has(item.file_url)).map((item) => item.id),
    [imageMediaItems, pickerSelectedUrlSet],
  );
  const serviceDisplayName = title.trim() || 'Service';

  useEffect(() => {
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

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  function updateProject(projectId: string, updates: Partial<Omit<ServiceProjectDraft, 'id'>>) {
    setServiceProjects((current) =>
      current.map((project) => (project.id === projectId ? { ...project, ...updates } : project)),
    );
  }

  function toggleProjectCollapsed(projectId: string) {
    setCollapsedProjectIds((current) =>
      current.includes(projectId) ? current.filter((id) => id !== projectId) : [...current, projectId],
    );
  }

  function toggleBeforeAfterGroupCollapsed(groupIndex: number) {
    setCollapsedBeforeAfterGroupIndexes((current) =>
      current.includes(groupIndex) ? current.filter((index) => index !== groupIndex) : [...current, groupIndex],
    );
  }

  function togglePickerImage(url: string) {
    if (!pickerTarget) return;

    if (pickerTarget.kind === 'beforeAfterBucket') {
      const { groupIndex, side } = pickerTarget;
      setBeforeAfterGroups((current) =>
        current.map((group, index) => {
          if (index !== groupIndex) return group;
          const currentUrls = side === 'before' ? group.beforeUrls : group.afterUrls;
          const nextUrls = currentUrls.includes(url)
            ? currentUrls.filter((value) => value !== url)
            : [...currentUrls, url];
          return side === 'before' ? { ...group, beforeUrls: nextUrls } : { ...group, afterUrls: nextUrls };
        }),
      );
      return;
    }

    setServiceProjects((current) =>
      current.map((project) => {
        if (project.id !== pickerTarget.projectId) return project;
        const nextUrls = project.photoUrls.includes(url)
          ? project.photoUrls.filter((value) => value !== url)
          : [...project.photoUrls, url];
        return { ...project, photoUrls: nextUrls };
      }),
    );
  }

  function addBeforeAfterGroup() {
    setBeforeAfterGroups((current) => [...current, { beforeUrls: [], afterUrls: [] }]);
  }

  function removeBeforeAfterGroup(groupIndex: number) {
    setBeforeAfterGroups((current) => current.filter((_, index) => index !== groupIndex));
    setCollapsedBeforeAfterGroupIndexes((current) =>
      current
        .filter((index) => index !== groupIndex)
        .map((index) => (index > groupIndex ? index - 1 : index)),
    );
    setPickerTarget((current) => {
      if (!current || current.kind !== 'beforeAfterBucket') return current;
      if (current.groupIndex === groupIndex) return null;
      if (current.groupIndex > groupIndex) return { ...current, groupIndex: current.groupIndex - 1 };
      return current;
    });
  }

  function removeBeforeAfterImage(groupIndex: number, side: 'before' | 'after', url: string) {
    setBeforeAfterGroups((current) =>
      current.map((group, index) => {
        if (index !== groupIndex) return group;
        const nextUrls = (side === 'before' ? group.beforeUrls : group.afterUrls).filter((value) => value !== url);
        return side === 'before' ? { ...group, beforeUrls: nextUrls } : { ...group, afterUrls: nextUrls };
      }),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const formData = new FormData();
      if (service?.id) formData.set('id', service.id);

      formData.set('title', title);
      formData.set('slug', slug);
      formData.set('excerpt', excerpt);
      formData.set('icon', icon);
      formData.set('parent_service_id', parentServiceId);
      formData.set('featured_image_url', featuredImageUrl);
      formData.set('price_range_min', priceRangeMin);
      formData.set('price_range_max', priceRangeMax);
      formData.set('sort_order', sortOrder);
      formData.set('meta_title', metaTitle);
      formData.set('meta_description', metaDescription);
      formData.set('content', JSON.stringify(contentMode === 'template' ? templateContent : blocks));
      formData.set('before_after_groups', JSON.stringify(
        beforeAfterGroups.map((group) => ({
          before_urls: group.beforeUrls,
          after_urls: group.afterUrls,
        })),
      ));
      formData.set('before_gallery_urls', JSON.stringify(beforeAfterGroups.map((group) => group.beforeUrls[0] ?? '')));
      formData.set('after_gallery_urls', JSON.stringify(beforeAfterGroups.map((group) => group.afterUrls[0] ?? '')));
      formData.set(
        'service_projects',
        JSON.stringify(
          serviceProjects.map((project) => ({
            title: project.title.trim(),
            summary: project.summary.trim(),
            photo_urls: project.photoUrls,
            service_area_ids: project.AreaIds,
          })),
        ),
      );

      await saveService(formData);
      router.push('/dashboard/services');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save service');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!service?.id) return;
    if (!window.confirm('Delete this service? This cannot be undone.')) return;

    setError(null);
    setIsDeleting(true);
    try {
      await deleteService(service.id);
      router.push('/dashboard/services');
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete service');
      setIsDeleting(false);
    }
  }

  return (
    <form id={formId} className="editor" onSubmit={handleSubmit}>
      <div className="editor__main">
        <div className="service-editor__title-row">
          <input
            className="editor__title-input"
            type="text"
            placeholder="Service title"
            value={title}
            onChange={(event) => {
              const nextTitle = event.target.value;
              setTitle(nextTitle);
              if (!slugEdited) {
                setSlug(slugify(nextTitle));
              }
            }}
            required
          />
          <details ref={iconPickerRef} className="service-icon-picker service-icon-picker--inline">
            <summary className="service-icon-picker__trigger" aria-label="Choose service icon">
              <span className={`service-icon-picker__btn ${isServiceIconKey(icon) ? 'service-icon-picker__btn--active' : ''}`}>
                {isServiceIconKey(icon) ? <ServiceIcon name={icon} /> : <span aria-hidden="true">-</span>}
              </span>
            </summary>
            <div className="service-icon-picker__menu" role="group" aria-label="Service icon options">
              <button
                type="button"
                className={`service-icon-picker__btn ${!isServiceIconKey(icon) ? 'service-icon-picker__btn--active' : ''}`}
                onClick={() => {
                  setIcon('');
                  iconPickerRef.current?.removeAttribute('open');
                }}
                aria-label="No icon"
                title="No icon"
              >
                <span aria-hidden="true">-</span>
              </button>
              {SERVICE_ICON_OPTIONS.map((option) => (
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
                  <ServiceIcon name={option.value} />
                </button>
              ))}
            </div>
          </details>
        </div>
        <input
          className="editor__slug-input"
          type="text"
          placeholder="service-slug"
          value={slug}
          onChange={(event) => {
            setSlugEdited(true);
            setSlug(event.target.value);
          }}
          required
        />
        <textarea
          className="editor__excerpt"
          placeholder="Short excerpt..."
          value={excerpt}
          onChange={(event) => setExcerpt(event.target.value)}
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
        <div className="editor__field-group service-editor__media-section">
          <label>{serviceDisplayName} Before &amp; After</label>
          <div className="service-editor__projects-head">
            <div className="service-editor__media-summary">
              <span className="service-editor__media-count">{beforeAfterGroups.length} group{beforeAfterGroups.length === 1 ? '' : 's'}</span>
              <span className="service-editor__media-count">
                {beforeAfterGroups.reduce((count, group) => count + group.beforeUrls.length, 0)} before
              </span>
              <span className="service-editor__media-count">
                {beforeAfterGroups.reduce((count, group) => count + group.afterUrls.length, 0)} after
              </span>
            </div>
            <div className="media-picker__controls">
              <button className="btn" type="button" onClick={addBeforeAfterGroup}>
                Add Group
              </button>
            </div>
          </div>
          {beforeAfterGroups.length === 0 && (
            <p className="service-editor__empty">No before/after groups yet. Add a group to start pairing photos.</p>
          )}
          <div className="service-editor__before-after-groups">
            {beforeAfterGroups.map((group, groupIndex) => (
              <div key={`group-${groupIndex}`} className="service-editor__project-card">
                <div className="service-editor__project-card-head">
                  <label>Group {groupIndex + 1}</label>
                  <div className="service-editor__project-card-meta">
                    <span className="service-editor__media-count">
                      {group.beforeUrls.length + group.afterUrls.length} photo
                      {group.beforeUrls.length + group.afterUrls.length === 1 ? '' : 's'}
                    </span>
                    <button
                      className="media-picker__icon-btn media-picker__icon-btn--danger media-picker__icon-btn--flat"
                      type="button"
                      onClick={() => removeBeforeAfterGroup(groupIndex)}
                      title="Remove group"
                      aria-label={`Remove before/after group ${groupIndex + 1}`}
                    >
                      <DeleteIcon />
                    </button>
                    <CollapseCaretToggle
                      collapsed={collapsedBeforeAfterGroupIndexSet.has(groupIndex)}
                      onClick={() => toggleBeforeAfterGroupCollapsed(groupIndex)}
                      expandedLabel={`Collapse group ${groupIndex + 1}`}
                      collapsedLabel={`Expand group ${groupIndex + 1}`}
                    />
                  </div>
                </div>
                {!collapsedBeforeAfterGroupIndexSet.has(groupIndex) && (
                <div className="service-editor__gallery-grid">
                  <div className="editor__field-group service-editor__media-card">
                    <div className="service-editor__media-card-head">
                      <label>Before</label>
                      <span className="service-editor__media-count">
                        {group.beforeUrls.length} photo{group.beforeUrls.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="editor__thumb-list">
                      <button
                        className="editor__thumb-placeholder"
                        type="button"
                        onClick={() => setPickerTarget({ kind: 'beforeAfterBucket', groupIndex, side: 'before' })}
                        aria-label={`Manage before images for group ${groupIndex + 1}`}
                      >
                        <span className="editor__thumb-placeholder-icon" aria-hidden="true">+</span>
                        <span>{group.beforeUrls.length > 0 ? 'Add / manage before' : 'Choose before images'}</span>
                      </button>
                      {group.beforeUrls.length > 0 &&
                        group.beforeUrls.map((url, photoIndex) => (
                          <div key={`before-${groupIndex}-${url}-${photoIndex}`} className="editor__thumb-item">
                            <div className="editor__thumb-frame">
                              <img
                                className="editor__thumb-image"
                                src={url}
                                alt={`Before photo group ${groupIndex + 1} image ${photoIndex + 1}`}
                              />
                              <div className="editor__thumb-actions" aria-label="Before image actions">
                                <button
                                  className="media-picker__icon-btn"
                                  type="button"
                                  onClick={() =>
                                    setPickerTarget({ kind: 'beforeAfterBucket', groupIndex, side: 'before' })
                                  }
                                  title="Change before images"
                                  aria-label="Change before images"
                                >
                                  <EditIcon />
                                </button>
                                <button
                                  className="media-picker__icon-btn media-picker__icon-btn--danger"
                                  type="button"
                                  onClick={() => removeBeforeAfterImage(groupIndex, 'before', url)}
                                  title="Remove image"
                                  aria-label="Remove image"
                                >
                                  <DeleteIcon />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="editor__field-group service-editor__media-card">
                    <div className="service-editor__media-card-head">
                      <label>After</label>
                      <span className="service-editor__media-count">
                        {group.afterUrls.length} photo{group.afterUrls.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="editor__thumb-list">
                      <button
                        className="editor__thumb-placeholder"
                        type="button"
                        onClick={() => setPickerTarget({ kind: 'beforeAfterBucket', groupIndex, side: 'after' })}
                        aria-label={`Manage after images for group ${groupIndex + 1}`}
                      >
                        <span className="editor__thumb-placeholder-icon" aria-hidden="true">+</span>
                        <span>{group.afterUrls.length > 0 ? 'Add / manage after' : 'Choose after images'}</span>
                      </button>
                      {group.afterUrls.length > 0 &&
                        group.afterUrls.map((url, photoIndex) => (
                          <div key={`after-${groupIndex}-${url}-${photoIndex}`} className="editor__thumb-item">
                            <div className="editor__thumb-frame">
                              <img
                                className="editor__thumb-image"
                                src={url}
                                alt={`After photo group ${groupIndex + 1} image ${photoIndex + 1}`}
                              />
                              <div className="editor__thumb-actions" aria-label="After image actions">
                                <button
                                  className="media-picker__icon-btn"
                                  type="button"
                                  onClick={() =>
                                    setPickerTarget({ kind: 'beforeAfterBucket', groupIndex, side: 'after' })
                                  }
                                  title="Change after images"
                                  aria-label="Change after images"
                                >
                                  <EditIcon />
                                </button>
                                <button
                                  className="media-picker__icon-btn media-picker__icon-btn--danger"
                                  type="button"
                                  onClick={() => removeBeforeAfterImage(groupIndex, 'after', url)}
                                  title="Remove image"
                                  aria-label="Remove image"
                                >
                                  <DeleteIcon />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="editor__field-group service-editor__projects-section">
          <div className="service-editor__projects-head">
            <label>{serviceDisplayName} Projects</label>
            <div className="media-picker__controls">
              <button
                className="btn"
                type="button"
                onClick={() =>
                  setServiceProjects((current) => [
                    ...current,
                    { id: createDraftId(), title: '', summary: '', photoUrls: [], AreaIds: [] },
                  ])
                }
              >
                Add Project
              </button>
            </div>
          </div>
          {serviceProjects.length === 0 && <p className="service-editor__empty">No service-specific projects added yet.</p>}
          {serviceProjects.map((project, index) => {
            const isCollapsed = collapsedProjectIdSet.has(project.id);
            const projectLabel = project.title.trim() || `Project ${index + 1}`;

            return (
              <div key={project.id} className="editor__field-group service-editor__project-card">
              <div className="service-editor__project-card-head">
                <label>{projectLabel}</label>
                <div className="service-editor__project-card-meta">
                  <span className="service-editor__media-count">
                    {project.photoUrls.length} photo{project.photoUrls.length === 1 ? '' : 's'}
                  </span>
                  <button
                    className="media-picker__icon-btn media-picker__icon-btn--danger media-picker__icon-btn--flat"
                    type="button"
                    onClick={() => {
                      setServiceProjects((current) => current.filter((item) => item.id !== project.id));
                      setCollapsedProjectIds((current) => current.filter((id) => id !== project.id));
                    }}
                    title="Remove project"
                    aria-label={`Remove ${projectLabel}`}
                  >
                    <DeleteIcon />
                  </button>
                  <CollapseCaretToggle
                    collapsed={isCollapsed}
                    onClick={() => toggleProjectCollapsed(project.id)}
                    expandedLabel="Collapse project"
                    collapsedLabel="Expand project"
                  />
                </div>
              </div>
              {!isCollapsed && (
                <>
              <div className="service-editor__project-grid">
                <input
                  type="text"
                  placeholder="Project title"
                  value={project.title}
                  onChange={(event) => updateProject(project.id, { title: event.target.value })}
                />
                <textarea
                  placeholder="Quick summary"
                  value={project.summary}
                  onChange={(event) => updateProject(project.id, { summary: event.target.value })}
                  rows={3}
                />
                {AreaOptions.length > 0 && (
                  <div className="editor__field-group">
                    <label>Linked Areas (Optional)</label>

                    <div className="service-editor__project-area-list">
                      {AreaOptions.map((areaOption) => {
                        const checked = project.AreaIds.includes(areaOption.id);
                        return (
                          <label key={`${project.id}-${areaOption.id}`} className="service-editor__project-area-option">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => {
                                updateProject(project.id, {
                                  AreaIds: event.target.checked
                                    ? Array.from(new Set([...project.AreaIds, areaOption.id]))
                                    : project.AreaIds.filter((id) => id !== areaOption.id),
                                });
                              }}
                            />
                            {areaOption.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="editor__thumb-list">
                <button
                  className="editor__thumb-placeholder"
                  type="button"
                  onClick={() => setPickerTarget({ kind: 'project', projectId: project.id })}
                  aria-label={`Manage photos for ${projectLabel}`}
                >
                  <span className="editor__thumb-placeholder-icon" aria-hidden="true">+</span>
                  <span>{project.photoUrls.length > 0 ? 'Add / manage photos' : 'Choose photos'}</span>
                </button>
                {project.photoUrls.length > 0 &&
                  project.photoUrls.map((url, photoIndex) => (
                    <div key={`${project.id}-${url}-${photoIndex}`} className="editor__thumb-item">
                      <div className="editor__thumb-frame">
                        <img
                          className="editor__thumb-image"
                          src={url}
                          alt={`${project.title || `Project ${index + 1}`} photo ${photoIndex + 1}`}
                        />
                        <div className="editor__thumb-actions" aria-label="Project image actions">
                          <button
                            className="media-picker__icon-btn"
                            type="button"
                            onClick={() => setPickerTarget({ kind: 'project', projectId: project.id })}
                            title="Manage project photos"
                            aria-label="Manage project photos"
                          >
                            <EditIcon />
                          </button>
                          <button
                            className="media-picker__icon-btn media-picker__icon-btn--danger"
                            type="button"
                            onClick={() =>
                              updateProject(project.id, {
                                photoUrls: project.photoUrls.filter((value) => value !== url),
                              })
                            }
                            title="Remove image"
                            aria-label="Remove image"
                          >
                            <DeleteIcon />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
                </>
              )}
            </div>
          );
          })}
        </div>
      </div>

      <aside className="editor__sidebar">
        <MediaPickerField
          label="Image"
          value={featuredImageUrl}
          onChange={setFeaturedImageUrl}
          items={mediaItems}
        />
        <div className="editor__field-group">
          <label>Parent Service (Optional)</label>
          <select
            value={parentServiceId}
            onChange={(event) => setParentServiceId(event.target.value)}
          >
            <option value="">None (top-level service)</option>
            {serviceOptions
              .filter((option) => option.id !== service?.id)
              .map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title}
                </option>
              ))}
          </select>
        </div>
        <div className="editor__field-group">
          <label>Sort Order</label>
          <input
            type="number"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          />
        </div>
        <div className="editor__field-group">
          <label>Price Range</label>
          <div className="editor__price-range">
            <input
              type="number"
              placeholder="Min"
              value={priceRangeMin}
              onChange={(event) => setPriceRangeMin(event.target.value)}
            />
            <span>-</span>
            <input
              type="number"
              placeholder="Max"
              value={priceRangeMax}
              onChange={(event) => setPriceRangeMax(event.target.value)}
            />
          </div>
        </div>

        <SeoFields
          metaTitle={metaTitle}
          metaDescription={metaDescription}
          availableTags={['{{service}}']}
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
          {!isNew && (
            <button
              className="btn"
              type="button"
              onClick={handleDelete}
              disabled={isSaving || isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </aside>

      {pickerTarget && (
        <div className="media-picker__overlay" onClick={() => setPickerTarget(null)}>
          <div className="media-picker__modal" onClick={(event) => event.stopPropagation()}>
            <div className="media-picker__header">
              <h3 className="media-picker__title">
                {pickerTarget.kind === 'beforeAfterBucket'
                  ? `Group ${pickerTarget.groupIndex + 1} ${pickerTarget.side === 'before' ? 'Before' : 'After'} Photos`
                  : 'Project Photos'}
              </h3>
              <button className="btn" type="button" onClick={() => setPickerTarget(null)}>
                Close
              </button>
            </div>
            <div className="media-picker__toolbar">
              <input
                type="text"
                placeholder="Search images..."
                value={mediaSearch}
                onChange={(event) => setMediaSearch(event.target.value)}
              />
              <span className="media-picker__count">{filteredMediaItems.length} images</span>
            </div>
            <div className="media-picker__body">
              <MediaGrid
                view="grid"
                items={filteredMediaItems.map((item) => ({
                  id: item.id,
                  file_name: item.file_name,
                  file_url: item.file_url,
                  file_type: item.file_type,
                  file_size: item.file_size ?? undefined,
                  alt_text: item.alt_text ?? undefined,
                }))}
                selectionMode
                selectedIds={pickerSelectedMediaIds}
                onToggleSelection={(item) => togglePickerImage(item.file_url)}
              />
            </div>
          </div>
        </div>
      )}
    </form>
  );
}












