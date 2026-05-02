'use client';

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BackendTabs from '@/components/backend/BackendTabs';
import EditorSaveButton from '@/components/backend/EditorSaveButton';
import { useRouter } from 'next/navigation';
import CollapseCaretToggle from '@/components/backend/CollapseCaretToggle';
import MediaGrid from '@/components/backend/MediaGrid';
import MediaPickerField from '@/components/backend/MediaPickerField';
import SeoFields from '@/components/backend/SeoFields';
import TemplatePageEditor from '@/components/backend/TemplatePageEditor';
import useDirtyState from '@/components/backend/useDirtyState';
import AppImage from '@/components/shared/AppImage';
import Button from '@/components/shared/Button';
import IconValue, { isIconImageValue } from '@/components/shared/IconValue';
import DeleteIcon from '@/components/shared/icons/DeleteIcon';
import EntityIcon, { ENTITY_ICON_OPTIONS } from '@/components/shared/EntityIcon';
import GrabIcon from '@/components/shared/icons/GrabIcon';
import { prepareFilesForMediaUpload } from '@/lib/media/clientUpload';
import { isIconMedia, isLogoMedia } from '@/lib/media/roles';
import {
  convertBasicBlocksToTemplatePageContent,
  createTemplatePageContent,
  toTemplatePageContent,
  type TemplatePageContent,
} from '@/lib/sections/templatePages';
import type { SharedSectionComponent } from '@/lib/sections/sharedSections';
import { saveService } from '@/lib/actions';
import type { MediaUsageKind, MediaUsageReference } from '@/lib/media/queries';
import type { Tables } from '@/lib/types/database';

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
  AreaIds: string[];
}

type Service = Tables<'services'>;
type Media = Tables<'media'>;
type PickerModalCategory = 'all' | 'graphics' | 'services' | 'team' | 'logo' | 'icon';
type PickerServiceFilter = 'all' | `service:${string}`;

interface UploadResponse {
  items: Media[];
  failedFiles: string[];
  error?: string;
}

interface MediaListResponse {
  items: Media[];
  hasMore: boolean;
  total?: number;
  error?: string;
}

interface ServiceEditorFormProps {
  service: Service | null;
  mediaItems: Media[];
  mediaUsageByUrl?: Record<string, MediaUsageReference[]>;
  AreaOptions?: Array<{ id: string; name: string }>;
  sharedSections?: SharedSectionComponent[];
}

const PICKER_PAGE_SIZE = 25;
const SERVICE_USAGE_KINDS: MediaUsageKind[] = ['service', 'service_gallery'];

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
  const AreaIds = toStringArray(row.area_ids);
  if (beforeUrls.length === 0 && afterUrls.length === 0) return null;
  return { beforeUrls, afterUrls, AreaIds };
}

function toBeforeAfterGroupDrafts(value: unknown): BeforeAfterGroupDraft[] {
  if (Array.isArray(value)) {
    const parsed = value.map(normalizeBeforeAfterGroup).filter((item): item is BeforeAfterGroupDraft => Boolean(item));
    if (parsed.length > 0) return parsed;
  }
  return [];
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
        AreaIds: toStringArray(row.area_ids),
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
  | { kind: 'serviceGallery' }
  | { kind: 'serviceIcon' }
  | null;

export default function ServiceEditorForm({
  service,
  mediaItems,
  mediaUsageByUrl = {},
  AreaOptions = [],
  sharedSections: initialSharedSections = [],
}: ServiceEditorFormProps) {
  const router = useRouter();
  const fixedTemplateKey = 'service-content-v1';
  const existingTemplateContent =
    toTemplatePageContent(service?.content) ??
    convertBasicBlocksToTemplatePageContent(
      service?.content,
      fixedTemplateKey,
      `${service?.title || 'Service'} Services`,
    );
  const defaultTemplateKey =
    existingTemplateContent?.templateKey ??
    fixedTemplateKey;

  const [title, setTitle] = useState(service?.title ?? '');
  const [slug, setSlug] = useState(service?.slug ?? '');
  const [excerpt] = useState(service?.excerpt ?? '');
  const [icon, setIcon] = useState(service?.icon ?? '');
  const [featuredImageUrl, setFeaturedImageUrl] = useState(service?.featured_image_url ?? '');
  const [metaTitle, setMetaTitle] = useState(service?.meta_title ?? '');
  const [metaDescription, setMetaDescription] = useState(service?.meta_description ?? '');
  const [templateContent, setTemplateContent] = useState<TemplatePageContent>(() => {
    if (existingTemplateContent) return existingTemplateContent;
    return createTemplatePageContent(defaultTemplateKey);
  });
  const [sharedSections, setSharedSections] = useState<SharedSectionComponent[]>(initialSharedSections);
  const [beforeAfterGroups, setBeforeAfterGroups] = useState<BeforeAfterGroupDraft[]>(
    () => toBeforeAfterGroupDrafts(service?.before_after_groups),
  );
  const [serviceGalleryUrls, setServiceGalleryUrls] = useState<string[]>(() => toStringArray(service?.service_gallery_urls));
  const [serviceProjects, setServiceProjects] = useState<ServiceProjectDraft[]>(
    () => toServiceProjectDrafts(service?.service_projects),
  );
  const [collapsedBeforeAfterGroupIndexes, setCollapsedBeforeAfterGroupIndexes] = useState<number[]>(() =>
    Array.from(
      { length: toBeforeAfterGroupDrafts(service?.before_after_groups).length },
      (_, index) => index,
    ),
  );
  const [collapsedProjectIds, setCollapsedProjectIds] = useState<string[]>(() =>
    serviceProjects.map((project) => project.id),
  );
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const [pickerCategory, setPickerCategory] = useState<PickerModalCategory>('all');
  const [pickerServiceFilter, setPickerServiceFilter] = useState<PickerServiceFilter>('all');
  const [pickerVisibleCount, setPickerVisibleCount] = useState(PICKER_PAGE_SIZE);
  const [availableMediaItems, setAvailableMediaItems] = useState<Media[]>(() => mediaItems);
  const [hasMorePickerMedia, setHasMorePickerMedia] = useState(() => mediaItems.length >= PICKER_PAGE_SIZE);
  const [pickerTotalImageCount, setPickerTotalImageCount] = useState(
    () => mediaItems.filter((item) => item.file_type.startsWith('image/')).length,
  );
  const [isLoadingMorePickerMedia, setIsLoadingMorePickerMedia] = useState(false);
  const [isPickerUploading, setIsPickerUploading] = useState(false);
  const [pickerUploadError, setPickerUploadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugEdited, setSlugEdited] = useState(Boolean(service?.slug));
  const [openTagMenu, setOpenTagMenu] = useState<'title' | 'slug' | null>(null);
  const [draggingGalleryUrl, setDraggingGalleryUrl] = useState<string | null>(null);
  const [galleryDropTargetUrl, setGalleryDropTargetUrl] = useState<string | null>(null);
  const iconPickerRef = useRef<HTMLDetailsElement | null>(null);
  const pickerUploadInputRef = useRef<HTMLInputElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const slugInputRef = useRef<HTMLInputElement | null>(null);
  const titleMenuRef = useRef<HTMLDivElement | null>(null);
  const slugMenuRef = useRef<HTMLDivElement | null>(null);

  const formId = useMemo(() => 'service-editor-form', []);
  const imageMediaItems = useMemo(
    () =>
      [...availableMediaItems]
        .filter((item) => item.file_type.startsWith('image/'))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [availableMediaItems],
  );
  const collapsedProjectIdSet = useMemo(() => new Set(collapsedProjectIds), [collapsedProjectIds]);
  const collapsedBeforeAfterGroupIndexSet = useMemo(
    () => new Set(collapsedBeforeAfterGroupIndexes),
    [collapsedBeforeAfterGroupIndexes],
  );
  const isDirty = useDirtyState({
    title,
    slug,
    excerpt,
    icon,
    featuredImageUrl,
    metaTitle,
    metaDescription,
    templateContent,
    sharedSections,
    beforeAfterGroups,
    serviceGalleryUrls,
    serviceProjects,
  });
  const pickerSelectedUrls = useMemo(() => {
    if (!pickerTarget) return [];
    if (pickerTarget.kind === 'serviceIcon') return isIconImageValue(icon) ? [icon] : [];
    if (pickerTarget.kind === 'serviceGallery') return serviceGalleryUrls;
    if (pickerTarget.kind === 'beforeAfterBucket') {
      const group = beforeAfterGroups[pickerTarget.groupIndex];
      if (!group) return [];
      return pickerTarget.side === 'before' ? group.beforeUrls : group.afterUrls;
    }
    return serviceProjects.find((project) => project.id === pickerTarget.projectId)?.photoUrls ?? [];
  }, [beforeAfterGroups, icon, pickerTarget, serviceGalleryUrls, serviceProjects]);
  const pickerSelectedUrlSet = useMemo(() => new Set(pickerSelectedUrls), [pickerSelectedUrls]);
  const pickerSelectedMediaIds = useMemo(
    () => imageMediaItems.filter((item) => pickerSelectedUrlSet.has(item.file_url)).map((item) => item.id),
    [imageMediaItems, pickerSelectedUrlSet],
  );
  const pickerSelectedCount = pickerSelectedUrls.length;
  const pickerIsGraphicsMedia = useCallback((item: Media) => {
    if (isLogoMedia(item) || isIconMedia(item)) return false;
    const refs = mediaUsageByUrl[item.file_url] ?? [];
    if (refs.some((ref) => ref.kind === 'team_member')) return false;
    if (refs.some((ref) => SERVICE_USAGE_KINDS.includes(ref.kind))) return false;
    return true;
  }, [mediaUsageByUrl]);
  const pickerLogoCount = useMemo(() => imageMediaItems.filter((item) => isLogoMedia(item)).length, [imageMediaItems]);
  const pickerIconCount = useMemo(() => imageMediaItems.filter((item) => isIconMedia(item)).length, [imageMediaItems]);
  const pickerGraphicsCount = useMemo(
    () => imageMediaItems.filter((item) => pickerIsGraphicsMedia(item)).length,
    [imageMediaItems, pickerIsGraphicsMedia],
  );
  const pickerServicesCount = useMemo(
    () =>
      imageMediaItems.filter((item) => {
        const refs = mediaUsageByUrl[item.file_url] ?? [];
        return refs.some((ref) => SERVICE_USAGE_KINDS.includes(ref.kind));
      }).length,
    [imageMediaItems, mediaUsageByUrl],
  );
  const pickerTeamCount = useMemo(
    () =>
      imageMediaItems.filter((item) => {
        const refs = mediaUsageByUrl[item.file_url] ?? [];
        return refs.some((ref) => ref.kind === 'team_member');
      }).length,
    [imageMediaItems, mediaUsageByUrl],
  );
  const pickerServiceTabs = useMemo(() => {
    const byService = new Map<string, { id: string; label: string; urls: Set<string> }>();
    for (const [url, refs] of Object.entries(mediaUsageByUrl)) {
      if (!url) continue;
      const seen = new Set<string>();
      for (const ref of refs) {
        if (!SERVICE_USAGE_KINDS.includes(ref.kind)) continue;
        if (seen.has(ref.entityId)) continue;
        seen.add(ref.entityId);
        const current = byService.get(ref.entityId);
        if (current) current.urls.add(url);
        else byService.set(ref.entityId, { id: ref.entityId, label: ref.label || 'Service', urls: new Set([url]) });
      }
    }
    return Array.from(byService.values())
      .map((row) => ({ id: row.id, label: row.label, count: row.urls.size }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [mediaUsageByUrl]);
  const pickerCategoryTabs = useMemo(() => {
    const items: Array<{ value: PickerModalCategory; label: string }> = [];
    items.push({ value: 'all', label: `All (${imageMediaItems.length})` });
    if (pickerGraphicsCount > 0 || pickerCategory === 'graphics') items.push({ value: 'graphics', label: `Graphics (${pickerGraphicsCount})` });
    if (pickerServicesCount > 0 || pickerCategory === 'services') items.push({ value: 'services', label: `Services (${pickerServicesCount})` });
    if (pickerTeamCount > 0 || pickerCategory === 'team') items.push({ value: 'team', label: `Team (${pickerTeamCount})` });
    if (pickerLogoCount > 0 || pickerCategory === 'logo') items.push({ value: 'logo', label: `Logo (${pickerLogoCount})` });
    if (pickerIconCount > 0 || pickerCategory === 'icon') items.push({ value: 'icon', label: `Icon (${pickerIconCount})` });
    return items;
  }, [imageMediaItems.length, pickerCategory, pickerGraphicsCount, pickerIconCount, pickerLogoCount, pickerServicesCount, pickerTeamCount]);
  const pickerFilteredMediaItems = useMemo(() => {
    if (pickerCategory === 'all') {
      return imageMediaItems;
    }
    if (pickerCategory === 'graphics') {
      return imageMediaItems.filter((item) => pickerIsGraphicsMedia(item));
    }
    if (pickerCategory === 'team') {
      return imageMediaItems.filter((item) => {
        const refs = mediaUsageByUrl[item.file_url] ?? [];
        return refs.some((ref) => ref.kind === 'team_member');
      });
    }
    if (pickerCategory === 'logo') {
      return imageMediaItems.filter((item) => isLogoMedia(item));
    }
    if (pickerCategory === 'icon') {
      return imageMediaItems.filter((item) => isIconMedia(item));
    }
    let serviceItems = imageMediaItems.filter((item) => {
      const refs = mediaUsageByUrl[item.file_url] ?? [];
      return refs.some((ref) => SERVICE_USAGE_KINDS.includes(ref.kind));
    });
    if (pickerServiceFilter.startsWith('service:')) {
      const serviceId = pickerServiceFilter.slice('service:'.length);
      serviceItems = serviceItems.filter((item) => {
        const refs = mediaUsageByUrl[item.file_url] ?? [];
        return refs.some((ref) => SERVICE_USAGE_KINDS.includes(ref.kind) && ref.entityId === serviceId);
      });
    }
    return serviceItems;
  }, [imageMediaItems, mediaUsageByUrl, pickerCategory, pickerIsGraphicsMedia, pickerServiceFilter]);
  const visiblePickerMediaItems = useMemo(
    () => pickerFilteredMediaItems.slice(0, pickerVisibleCount),
    [pickerFilteredMediaItems, pickerVisibleCount],
  );
  const serviceDisplayName = title.trim() || 'Service';
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
          '{{service}}',
          '{{url}}',
          '{{site_url}}',
        ]),
      ),
    [],
  );

  useEffect(() => {
    setAvailableMediaItems(mediaItems);
    setHasMorePickerMedia(mediaItems.length >= PICKER_PAGE_SIZE);
    setPickerTotalImageCount(mediaItems.filter((item) => item.file_type.startsWith('image/')).length);
  }, [mediaItems]);

  useEffect(() => {
    setPickerUploadError(null);
  }, [pickerTarget]);

  useEffect(() => {
    setPickerVisibleCount(PICKER_PAGE_SIZE);
  }, [pickerTarget, pickerCategory, pickerServiceFilter]);

  useEffect(() => {
    if (!pickerTarget) return;
    setPickerCategory('all');
    setPickerServiceFilter('all');
  }, [pickerTarget]);

  const loadMorePickerMedia = useCallback(async () => {
    if (isLoadingMorePickerMedia || !hasMorePickerMedia) return;

    setIsLoadingMorePickerMedia(true);
    setPickerUploadError(null);

    try {
      const response = await fetch(
        `/api/media/list?imagesOnly=true&limit=${PICKER_PAGE_SIZE}&offset=${availableMediaItems.length}`,
        { method: 'GET' },
      );

      let payload: MediaListResponse | null = null;
      try {
        payload = (await response.json()) as MediaListResponse;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(payload?.error || 'Unable to load more media');
      }

      const nextItems = (payload?.items ?? []).filter((item) => item.file_type.startsWith('image/'));
      setAvailableMediaItems((current) => {
        const byId = new Map(current.map((item) => [item.id, item]));
        for (const item of nextItems) byId.set(item.id, item);
        return Array.from(byId.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      });
      setHasMorePickerMedia(Boolean(payload?.hasMore));
      if (typeof payload?.total === 'number' && Number.isFinite(payload.total)) {
        setPickerTotalImageCount(payload.total);
      }
      setPickerVisibleCount((current) => current + PICKER_PAGE_SIZE);
    } catch (loadError) {
      setPickerUploadError(loadError instanceof Error ? loadError.message : 'Unable to load more media');
    } finally {
      setIsLoadingMorePickerMedia(false);
    }
  }, [availableMediaItems.length, hasMorePickerMedia, isLoadingMorePickerMedia]);

  useEffect(() => {
    if (!pickerTarget) return;
    if (pickerCategory !== 'services') return;
    if (!pickerServiceFilter.startsWith('service:')) return;
    const activeServiceTab = pickerServiceTabs.find((tab) => `service:${tab.id}` === pickerServiceFilter);
    if (!activeServiceTab || activeServiceTab.count <= 0) return;
    if (pickerFilteredMediaItems.length > 0) return;
    if (!hasMorePickerMedia || isLoadingMorePickerMedia) return;
    void loadMorePickerMedia();
  }, [
    hasMorePickerMedia,
    isLoadingMorePickerMedia,
    loadMorePickerMedia,
    pickerCategory,
    pickerFilteredMediaItems.length,
    pickerServiceTabs,
    pickerTarget,
    pickerServiceFilter,
  ]);

  useEffect(() => {
    function handleTagMenuClickOutside(event: MouseEvent) {
      if (openTagMenu === 'title' && titleMenuRef.current && !titleMenuRef.current.contains(event.target as Node)) {
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

  function updateBeforeAfterGroup(groupIndex: number, updates: Partial<BeforeAfterGroupDraft>) {
    setBeforeAfterGroups((current) =>
      current.map((group, index) => (index === groupIndex ? { ...group, ...updates } : group)),
    );
  }

  function togglePickerImage(url: string) {
    if (!pickerTarget) return;
    if (pickerTarget.kind === 'serviceIcon') {
      setIcon((current) => (current === url ? '' : url));
      setPickerTarget(null);
      return;
    }

    if (pickerTarget.kind === 'serviceGallery') {
      setServiceGalleryUrls((current) =>
        current.includes(url) ? current.filter((value) => value !== url) : [...current, url],
      );
      return;
    }

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

  function appendUrlsToPickerTarget(urls: string[]) {
    if (!pickerTarget || urls.length === 0) return;
    const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));
    if (uniqueUrls.length === 0) return;
    if (pickerTarget.kind === 'serviceIcon') {
      setIcon(uniqueUrls[0]);
      return;
    }

    if (pickerTarget.kind === 'serviceGallery') {
      setServiceGalleryUrls((current) => Array.from(new Set([...current, ...uniqueUrls])));
      return;
    }

    if (pickerTarget.kind === 'beforeAfterBucket') {
      const { groupIndex, side } = pickerTarget;
      setBeforeAfterGroups((current) =>
        current.map((group, index) => {
          if (index !== groupIndex) return group;
          const currentUrls = side === 'before' ? group.beforeUrls : group.afterUrls;
          const nextUrls = Array.from(new Set([...currentUrls, ...uniqueUrls]));
          return side === 'before' ? { ...group, beforeUrls: nextUrls } : { ...group, afterUrls: nextUrls };
        }),
      );
      return;
    }

    setServiceProjects((current) =>
      current.map((project) =>
        project.id === pickerTarget.projectId
          ? { ...project, photoUrls: Array.from(new Set([...project.photoUrls, ...uniqueUrls])) }
          : project,
      ),
    );
  }

  async function handlePickerUploadChange(event: ChangeEvent<HTMLInputElement>) {
    const originalFiles = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (originalFiles.length === 0) return;

    setPickerUploadError(null);
    setIsPickerUploading(true);

    try {
      const files = await prepareFilesForMediaUpload(originalFiles);
      const formData = new FormData();
      for (const file of files) {
        formData.append('files', file, file.name);
      }
      formData.append('role', 'service_gallery');

      const response = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      let payload: UploadResponse | null = null;
      try {
        payload = (await response.json()) as UploadResponse;
      } catch {
        payload = null;
      }

      if (!response.ok) {
        throw new Error(payload?.error || 'Upload failed');
      }

      const uploadedItems = (payload?.items ?? []).filter((item) => item.file_type.startsWith('image/'));
      if (uploadedItems.length === 0) {
        throw new Error('Upload succeeded but no image files were returned');
      }

      setAvailableMediaItems((current) => {
        const byId = new Map(current.map((item) => [item.id, item]));
        for (const item of uploadedItems) byId.set(item.id, item);
        return Array.from(byId.values());
      });
      appendUrlsToPickerTarget(uploadedItems.map((item) => item.file_url));

      if (payload?.failedFiles?.length) {
        setPickerUploadError(`Some files failed: ${payload.failedFiles.join(', ')}`);
      }
    } catch (uploadError) {
      setPickerUploadError(uploadError instanceof Error ? uploadError.message : 'Upload failed');
    } finally {
      setIsPickerUploading(false);
    }
  }

  function addBeforeAfterGroup() {
    setBeforeAfterGroups((current) => [...current, { beforeUrls: [], afterUrls: [], AreaIds: [] }]);
  }

  function reorderGalleryImage(draggedUrl: string, targetUrl: string) {
    if (!draggedUrl || !targetUrl || draggedUrl === targetUrl) return;
    setServiceGalleryUrls((current) => {
      const fromIndex = current.indexOf(draggedUrl);
      const toIndex = current.indexOf(targetUrl);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return current;
      const next = [...current];
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, draggedUrl);
      return next;
    });
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
      formData.set('featured_image_url', featuredImageUrl);
      formData.set('meta_title', metaTitle);
      formData.set('meta_description', metaDescription);
      formData.set('content', JSON.stringify(templateContent));
      formData.set('shared_sections', JSON.stringify(sharedSections));
      formData.set('before_after_groups', JSON.stringify(
        beforeAfterGroups.map((group) => ({
          before_urls: group.beforeUrls,
          after_urls: group.afterUrls,
          area_ids: group.AreaIds,
        })),
      ));
      formData.set(
        'service_projects',
        JSON.stringify(
          serviceProjects.map((project) => ({
            title: project.title.trim(),
            summary: project.summary.trim(),
            photo_urls: project.photoUrls,
            area_ids: project.AreaIds,
          })),
        ),
      );
      formData.set('service_gallery_urls', JSON.stringify(serviceGalleryUrls));

      await saveService(formData);
      router.push('/dashboard/services');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save service');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form id={formId} className="editor service-editor" onSubmit={handleSubmit}>
      <div className="editor__main">
        <div className="service-editor__title-row">
          <input
            ref={titleInputRef}
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
              <span className={`service-icon-picker__btn ${icon ? 'service-icon-picker__btn--active' : ''}`}>
                {icon ? (
                  <IconValue value={icon} imageClassName="service-icon-picker__image" />
                ) : (
                  <span aria-hidden="true">-</span>
                )}
              </span>
            </summary>
            <div className="service-icon-picker__menu" role="group" aria-label="Service icon options">
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
              <button
                type="button"
                className={`service-icon-picker__btn ${iconImageUrl ? 'service-icon-picker__btn--active' : ''}`}
                onClick={() => {
                  setPickerTarget({ kind: 'serviceIcon' });
                  iconPickerRef.current?.removeAttribute('open');
                }}
                aria-label="Choose icon image"
                title="Choose icon image"
              >
                {iconImageUrl ? (
                  <AppImage role="logo" src={iconImageUrl} alt="" className="service-icon-picker__image" width={48} height={48} />
                ) : (
                  <span aria-hidden="true">+</span>
                )}
              </button>
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
          <div className="seo-fields__token-menu" ref={titleMenuRef}>
            <button
              type="button"
              className="seo-fields__token-trigger"
              aria-label="Insert dynamic tag into service title"
              onClick={() => setOpenTagMenu((current) => (current === 'title' ? null : 'title'))}
            >
              <BoltIcon />
            </button>
            {openTagMenu === 'title' && (
              <div className="seo-fields__token-dropdown">
                {fieldTags.map((tag) => (
                  <button
                    key={`service-title-${tag}`}
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
            placeholder="service-slug"
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
                    key={`service-slug-${tag}`}
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
        <div className="editor__field-group service-editor__media-section">
          <div className="service-editor__projects-head">
            <label>{serviceDisplayName} Gallery</label>
            <div className="service-editor__media-summary">
              <span className="service-editor__media-count">
                {serviceGalleryUrls.length} photo{serviceGalleryUrls.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
          <div className="editor__thumb-list">
            <button
              className="editor__thumb-placeholder"
              type="button"
              onClick={() => setPickerTarget({ kind: 'serviceGallery' })}
              aria-label={`Manage gallery images for ${serviceDisplayName}`}
            >
              <span className="editor__thumb-placeholder-icon" aria-hidden="true">+</span>
            </button>
            {serviceGalleryUrls.length > 0 &&
              serviceGalleryUrls.map((url, imageIndex) => (
                <div
                  key={`service-gallery-${url}-${imageIndex}`}
                  className={`editor__thumb-item service-editor__gallery-item ${
                    draggingGalleryUrl === url ? 'service-editor__gallery-item--dragging' : ''
                  } ${galleryDropTargetUrl === url && draggingGalleryUrl !== url ? 'service-editor__gallery-item--drop-target' : ''}`}
                  draggable
                  onDragStart={() => {
                    setDraggingGalleryUrl(url);
                    setGalleryDropTargetUrl(url);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (draggingGalleryUrl && draggingGalleryUrl !== url) {
                      setGalleryDropTargetUrl(url);
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (draggingGalleryUrl) {
                      reorderGalleryImage(draggingGalleryUrl, url);
                    }
                    setDraggingGalleryUrl(null);
                    setGalleryDropTargetUrl(null);
                  }}
                  onDragEnd={() => {
                    setDraggingGalleryUrl(null);
                    setGalleryDropTargetUrl(null);
                  }}
                >
                  <div className="editor__thumb-frame">
                    <AppImage
                      role="gallery"
                      className="editor__thumb-image"
                      src={url}
                      alt={`${serviceDisplayName} gallery image ${imageIndex + 1}`}
                      width={480}
                      height={360}
                    />
                    <div className="editor__thumb-actions" aria-label="Gallery image actions">
                      <button
                        className="media-picker__icon-btn media-picker__icon-btn--danger"
                        type="button"
                        onClick={() => setServiceGalleryUrls((current) => current.filter((value) => value !== url))}
                        title="Remove image"
                        aria-label="Remove image"
                      >
                        <DeleteIcon />
                      </button>
                    </div>
                    <div className="service-editor__gallery-overlay" aria-hidden="true">
                      <span className="service-editor__gallery-drag-hint">{imageIndex + 1}</span>
                      <span className="service-editor__gallery-grab-icon">
                        <GrabIcon />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
        <div className="editor__field-group service-editor__media-section">
          <div className="service-editor__projects-head">
            <label>{serviceDisplayName} Before &amp; After</label>
            <div className="media-picker__controls">
              <span className="service-editor__media-count">{beforeAfterGroups.length} group{beforeAfterGroups.length === 1 ? '' : 's'}</span>
              <Button type="button" variant="btn--secondary" size="btn--sm" onClick={addBeforeAfterGroup}>
                Add Group
              </Button>
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
                <div className="service-editor__before-after-layout">
                  <div className="service-editor__gallery-grid">
                    <div className="editor__field-group service-editor__media-card">
                      <div className="service-editor__media-card-head">
                        <label>Before</label>
                      </div>
                      <div className="editor__thumb-list">
                        <button
                          className="editor__thumb-placeholder"
                          type="button"
                          onClick={() => setPickerTarget({ kind: 'beforeAfterBucket', groupIndex, side: 'before' })}
                          aria-label={`Manage before images for group ${groupIndex + 1}`}
                        >
                          <span className="editor__thumb-placeholder-icon" aria-hidden="true">+</span>
                        </button>
                        {group.beforeUrls.length > 0 &&
                          group.beforeUrls.map((url, photoIndex) => (
                            <div key={`before-${groupIndex}-${url}-${photoIndex}`} className="editor__thumb-item">
                              <div className="editor__thumb-frame">
                                <AppImage
                                  role="gallery"
                                  className="editor__thumb-image"
                                  src={url}
                                  alt={`Before photo group ${groupIndex + 1} image ${photoIndex + 1}`}
                                  width={480}
                                  height={360}
                                />
                                <div className="editor__thumb-actions" aria-label="Before image actions">
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
                      </div>
                      <div className="editor__thumb-list">
                        <button
                          className="editor__thumb-placeholder"
                          type="button"
                          onClick={() => setPickerTarget({ kind: 'beforeAfterBucket', groupIndex, side: 'after' })}
                          aria-label={`Manage after images for group ${groupIndex + 1}`}
                        >
                          <span className="editor__thumb-placeholder-icon" aria-hidden="true">+</span>
                        </button>
                        {group.afterUrls.length > 0 &&
                          group.afterUrls.map((url, photoIndex) => (
                            <div key={`after-${groupIndex}-${url}-${photoIndex}`} className="editor__thumb-item">
                              <div className="editor__thumb-frame">
                                <AppImage
                                  role="gallery"
                                  className="editor__thumb-image"
                                  src={url}
                                  alt={`After photo group ${groupIndex + 1} image ${photoIndex + 1}`}
                                  width={480}
                                  height={360}
                                />
                                <div className="editor__thumb-actions" aria-label="After image actions">
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

                  {AreaOptions.length > 0 && (
                    <div className="editor__field-group service-editor__area-links">
                      <label>Linked Areas (Optional)</label>
                      <div className="service-editor__project-area-list">
                        {AreaOptions.map((areaOption) => {
                          const checked = group.AreaIds.includes(areaOption.id);
                          return (
                            <label key={`before-after-${groupIndex}-${areaOption.id}`} className="service-editor__project-area-option">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) => {
                                  updateBeforeAfterGroup(groupIndex, {
                                    AreaIds: event.target.checked
                                      ? Array.from(new Set([...group.AreaIds, areaOption.id]))
                                      : group.AreaIds.filter((id) => id !== areaOption.id),
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
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="editor__field-group service-editor__projects-section">
          <div className="service-editor__projects-head">
            <label>{serviceDisplayName} Projects</label>
            <div className="media-picker__controls">
              <span className="service-editor__media-count">
                {serviceProjects.length} project{serviceProjects.length === 1 ? '' : 's'}
              </span>
              <Button
                type="button"
                variant="btn--secondary"
                size="btn--sm"
                onClick={() =>
                  setServiceProjects((current) => [
                    ...current,
                    { id: createDraftId(), title: '', summary: '', photoUrls: [], AreaIds: [] },
                  ])
                }
              >
                Add Project
              </Button>
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
              </div>
              <div className="editor__thumb-list">
                <button
                  className="editor__thumb-placeholder"
                  type="button"
                  onClick={() => setPickerTarget({ kind: 'project', projectId: project.id })}
                  aria-label={`Manage photos for ${projectLabel}`}
                >
                  <span className="editor__thumb-placeholder-icon" aria-hidden="true">+</span>
                </button>
                {project.photoUrls.length > 0 &&
                  project.photoUrls.map((url, photoIndex) => (
                    <div key={`${project.id}-${url}-${photoIndex}`} className="editor__thumb-item">
                      <div className="editor__thumb-frame">
                        <AppImage
                          role="gallery"
                          className="editor__thumb-image"
                          src={url}
                          alt={`${project.title || `Project ${index + 1}`} photo ${photoIndex + 1}`}
                          width={480}
                          height={360}
                        />
                        <div className="editor__thumb-actions" aria-label="Project image actions">
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
              {AreaOptions.length > 0 && (
                <div className="editor__field-group service-editor__area-links">
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
                </>
              )}
              </div>
          );
          })}
        </div>
      </div>

      <aside className="editor__sidebar">
        <MediaPickerField
          className="service-editor__featured-image-field"
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
          availableTags={['{{service}}']}
          onChange={(field, value) => {
            if (field === 'meta_title') setMetaTitle(value);
            if (field === 'meta_description') setMetaDescription(value);
          }}
        />

        {error && <p className="form-error">{error}</p>}

        <div className="editor__field-group">
          <EditorSaveButton isDirty={isDirty} isSaving={isSaving} disabled={isSaving} />
        </div>
      </aside>

      {pickerTarget && (
        <div className="media-picker__overlay" onClick={() => setPickerTarget(null)}>
          <div className="media-picker__modal" onClick={(event) => event.stopPropagation()}>
            <div className="media-picker__header">
              <div className="media-picker__header-main">
                <div className="media-picker__header-top">
                  <div className="media-picker__title-wrap media-picker__title-wrap--inline">
                    <h3 className="media-picker__title">
                      {pickerTarget.kind === 'beforeAfterBucket'
                        ? `Group ${pickerTarget.groupIndex + 1} ${pickerTarget.side === 'before' ? 'Before' : 'After'} Photos`
                        : pickerTarget.kind === 'project'
                          ? 'Project Photos'
                          : pickerTarget.kind === 'serviceIcon'
                            ? 'Service Icon Image'
                            : 'Service Gallery'}
                    </h3>
                    <span className="media-picker__count">
                      {pickerFilteredMediaItems.length} {pickerFilteredMediaItems.length === 1 ? 'photo' : 'photos'}
                    </span>
                    <span className="media-picker__count">
                      {pickerSelectedCount} selected
                    </span>
                  </div>
                  <div className="media-picker__header-actions">
                    {(
                      pickerTarget.kind === 'serviceGallery' ||
                      pickerTarget.kind === 'project' ||
                      pickerTarget.kind === 'beforeAfterBucket'
                    ) && (
                      <>
                        <button
                          className="media-picker__header-btn media-picker__header-btn--primary"
                          type="button"
                          onClick={() => pickerUploadInputRef.current?.click()}
                          disabled={isPickerUploading}
                          aria-label={isPickerUploading ? 'Uploading' : 'Upload'}
                          title={isPickerUploading ? 'Uploading' : 'Upload'}
                        >
                          <UploadIcon />
                          <span>{isPickerUploading ? 'Uploading...' : 'Upload'}</span>
                        </button>
                        <input
                          ref={pickerUploadInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handlePickerUploadChange}
                          style={{ display: 'none' }}
                        />
                      </>
                    )}
                    <button
                      className={`media-picker__header-btn ${pickerSelectedCount > 0 ? 'media-picker__header-btn--primary' : 'media-picker__header-btn--secondary'}`}
                      type="button"
                      onClick={() => setPickerTarget(null)}
                      disabled={pickerSelectedCount === 0}
                    >
                      Done
                    </button>
                    <button
                      className="media-picker__header-btn media-picker__header-btn--secondary media-picker__header-btn--icon-only"
                      type="button"
                      onClick={() => setPickerTarget(null)}
                      aria-label="Close"
                      title="Close"
                    >
                      <CloseIcon />
                    </button>
                  </div>
                </div>
                <BackendTabs
                  ariaLabel="Filter media by category"
                  activeValue={pickerCategory}
                  className="media-picker__filters"
                  wrap
                  items={pickerCategoryTabs}
                  onChange={(value) => setPickerCategory(value as PickerModalCategory)}
                />
                {pickerCategory === 'services' && pickerServiceTabs.length > 0 && (
                  <BackendTabs
                    ariaLabel="Filter media by service"
                    activeValue={pickerServiceFilter}
                    className="media-picker__filters media-picker__filters--sub"
                    wrap
                    items={[
                      { value: 'all', label: `All Services (${pickerServiceTabs.reduce((sum, tab) => sum + tab.count, 0)})` },
                      ...pickerServiceTabs.map((serviceTab) => ({
                        value: `service:${serviceTab.id}`,
                        label: `${serviceTab.label} (${serviceTab.count})`,
                      })),
                    ]}
                    onChange={(value) => setPickerServiceFilter(value as PickerServiceFilter)}
                  />
                )}
              </div>
            </div>
            {pickerTarget.kind === 'serviceGallery' && pickerUploadError && (
              <p className="form-error" style={{ margin: '0.5rem 0 0' }}>
                {pickerUploadError}
              </p>
            )}
            <div className="media-picker__body">
              <MediaGrid
                view="grid"
                items={visiblePickerMediaItems.map((item) => ({
                  id: item.id,
                  file_name: item.file_name,
                  file_url: item.file_url,
                  file_type: item.file_type,
                  file_size: item.file_size ?? undefined,
                  alt_text: item.alt_text ?? undefined,
                  variants: item.variants ?? undefined,
                }))}
                selectionMode
                selectedIds={pickerSelectedMediaIds}
                onToggleSelection={(item) => togglePickerImage(item.file_url)}
              />
            </div>
            {(pickerFilteredMediaItems.length > visiblePickerMediaItems.length || hasMorePickerMedia) && (
              <div className="media-picker__footer">
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    if (pickerFilteredMediaItems.length > visiblePickerMediaItems.length) {
                      setPickerVisibleCount((current) => current + PICKER_PAGE_SIZE);
                      return;
                    }
                    void loadMorePickerMedia();
                  }}
                  disabled={isLoadingMorePickerMedia}
                >
                  {isLoadingMorePickerMedia
                    ? 'Loading...'
                    : pickerFilteredMediaItems.length > visiblePickerMediaItems.length
                      ? `Load More (${pickerFilteredMediaItems.length - visiblePickerMediaItems.length} remaining)`
                      : 'Load More from Library'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
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

function UploadIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M20 16v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}















