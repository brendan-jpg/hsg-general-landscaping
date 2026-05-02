'use client';

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BackendTabs from '@/components/backend/BackendTabs';
import ModuleShell from '@/components/backend/shell/ModuleShell';
import MediaGrid from '@/components/backend/MediaGrid';
import AppImage from '@/components/shared/AppImage';
import Button from '@/components/shared/Button';
import DeleteIcon from '@/components/shared/icons/DeleteIcon';
import UploadIcon from '@/components/shared/icons/UploadIcon';
import { prepareFilesForMediaUpload } from '@/lib/media/clientUpload';
import { getMediaRoleFromMetadata } from '@/lib/media/roles';
import type { MediaUsageKind, MediaUsageReference } from '@/lib/media/queries';
import type { Tables } from '@/lib/types/database';

type Media = Tables<'media'>;
type ServiceFilter = 'all' | `service:${string}`;
type GraphicsFilter = 'logo' | 'icon' | 'other';
type MediaTab = 'all' | 'graphics' | 'other' | 'services' | 'team';

interface MediaLibraryManagerProps {
  initialItems: Media[];
  initialUsageByUrl?: Record<string, MediaUsageReference[]>;
  initialBusinessLogoUrl?: string | null;
  initialBusinessFaviconUrl?: string | null;
}

const MEDIA_USAGE_KIND_LABELS: Record<MediaUsageKind, string> = {
  service: 'Service',
  service_gallery: 'Service Gallery',
  area: 'Area',
  team_member: 'Team Members',
  blog_post: 'Blog Posts',
  page: 'Pages',
  testimonial: 'Testimonials',
};
const SERVICE_USAGE_KINDS: MediaUsageKind[] = ['service', 'service_gallery'];

async function uploadManagedMedia(files: File[], role?: 'logo' | 'icon' | 'graphic' | 'generic') {
  const formData = new FormData();

  for (const file of files) {
    formData.append('files', file, file.name);
  }
  if (role) formData.append('role', role);

  const response = await fetch('/api/media/upload', {
    method: 'POST',
    body: formData,
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : 'Upload failed';
    throw new Error(message);
  }

  return payload as {
    items: Media[];
    failedFiles: string[];
  };
}

export default function MediaLibraryManager({
  initialItems,
  initialUsageByUrl = {},
  initialBusinessLogoUrl = null,
  initialBusinessFaviconUrl = null,
}: MediaLibraryManagerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Media[]>(initialItems);
  const [usageByUrl] = useState<Record<string, MediaUsageReference[]>>(initialUsageByUrl);
  const [previewItem, setPreviewItem] = useState<Media | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>('all');
  const [graphicsFilter, setGraphicsFilter] = useState<GraphicsFilter>('logo');
  const [mediaTab, setMediaTab] = useState<MediaTab>('all');
  const [businessLogoUrl, setBusinessLogoUrl] = useState(initialBusinessLogoUrl);
  const [businessFaviconUrl, setBusinessFaviconUrl] = useState(initialBusinessFaviconUrl);
  const normalizeUrl = (value: string | null | undefined) => {
    if (!value) return '';
    const raw = value.trim();
    if (!raw) return '';
    try {
      const parsed = new URL(raw);
      parsed.search = '';
      parsed.hash = '';
      return parsed.toString();
    } catch {
      return raw;
    }
  };
  const normalizedBusinessLogoUrl = useMemo(() => normalizeUrl(businessLogoUrl), [businessLogoUrl]);
  const normalizedBusinessFaviconUrl = useMemo(() => normalizeUrl(businessFaviconUrl), [businessFaviconUrl]);

  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [items]
  );
  const usageByItemId = useMemo(() => {
    const entries: Record<string, MediaUsageReference[]> = {};
    for (const item of items) {
      entries[item.id] = usageByUrl[item.file_url] ?? [];
    }
    return entries;
  }, [items, usageByUrl]);
  const isTeamItem = useCallback((item: Media) => {
    const refs = usageByItemId[item.id] ?? [];
    return refs.some((ref) => ref.kind === 'team_member');
  }, [usageByItemId]);
  const isServiceItem = useCallback((item: Media) => {
    const refs = usageByItemId[item.id] ?? [];
    return refs.some((ref) => SERVICE_USAGE_KINDS.includes(ref.kind));
  }, [usageByItemId]);
  const isBusinessLogoItem = useCallback(
    (item: Media) => normalizedBusinessLogoUrl !== '' && normalizeUrl(item.file_url) === normalizedBusinessLogoUrl,
    [normalizedBusinessLogoUrl],
  );
  const isBusinessFaviconItem = useCallback(
    (item: Media) => normalizedBusinessFaviconUrl !== '' && normalizeUrl(item.file_url) === normalizedBusinessFaviconUrl,
    [normalizedBusinessFaviconUrl],
  );
  const isLogoItem = useCallback((item: Media) => {
    const role = getMediaRoleFromMetadata(item.metadata);
    return role === 'logo' || isBusinessLogoItem(item);
  }, [isBusinessLogoItem]);
  const isFaviconItem = useCallback((item: Media) => {
    const role = getMediaRoleFromMetadata(item.metadata);
    return role === 'icon' || isBusinessFaviconItem(item);
  }, [isBusinessFaviconItem]);
  const isOtherGraphicsItem = useCallback(
    (item: Media) => getMediaRoleFromMetadata(item.metadata) === 'graphic',
    [],
  );
  const isOtherMediaItem = useCallback(
    (item: Media) =>
      !isOtherGraphicsItem(item) &&
      !isLogoItem(item) &&
      !isFaviconItem(item) &&
      !isTeamItem(item) &&
      !isServiceItem(item),
    [isFaviconItem, isLogoItem, isOtherGraphicsItem, isServiceItem, isTeamItem],
  );
  const teamCount = useMemo(
    () => items.filter((item) => isTeamItem(item)).length,
    [isTeamItem, items],
  );
  const servicesCount = useMemo(
    () => items.filter((item) => isServiceItem(item)).length,
    [isServiceItem, items],
  );
  const serviceTabs = useMemo(() => {
    const byService = new Map<string, { id: string; label: string; urls: Set<string> }>();
    for (const [url, refs] of Object.entries(usageByUrl)) {
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
  }, [usageByUrl]);
  const logoCount = useMemo(() => items.filter((item) => isLogoItem(item)).length, [isLogoItem, items]);
  const iconCount = useMemo(() => items.filter((item) => isFaviconItem(item)).length, [isFaviconItem, items]);
  const graphicsCount = useMemo(() => items.filter((item) => isOtherGraphicsItem(item)).length, [isOtherGraphicsItem, items]);
  const otherCount = useMemo(() => items.filter((item) => isOtherMediaItem(item)).length, [isOtherMediaItem, items]);
  const allCount = items.length;
  const allGraphicsCount = useMemo(() => logoCount + iconCount + graphicsCount, [graphicsCount, iconCount, logoCount]);
  const filteredSortedItems = useMemo(() => {
    let base = sortedItems;
    if (mediaTab === 'graphics') {
      if (graphicsFilter === 'logo') {
        base = sortedItems.filter((item) => isLogoItem(item));
      } else if (graphicsFilter === 'icon') {
        base = sortedItems.filter((item) => isFaviconItem(item));
      } else {
        base = sortedItems.filter((item) => isOtherGraphicsItem(item));
      }
    } else if (mediaTab === 'other') {
      base = sortedItems.filter((item) => isOtherMediaItem(item));
    } else if (mediaTab === 'team') {
      base = sortedItems.filter((item) => isTeamItem(item));
    } else if (mediaTab === 'services') {
      base = sortedItems.filter((item) => isServiceItem(item));
      if (serviceFilter.startsWith('service:')) {
        const serviceId = serviceFilter.slice('service:'.length);
        base = base.filter((item) => {
          const refs = usageByItemId[item.id] ?? [];
          return refs.some((ref) => SERVICE_USAGE_KINDS.includes(ref.kind) && ref.entityId === serviceId);
        });
      }
    }
    return base;
  }, [graphicsFilter, isFaviconItem, isLogoItem, isOtherGraphicsItem, isOtherMediaItem, isServiceItem, isTeamItem, mediaTab, serviceFilter, sortedItems, usageByItemId]);
  const activeUploadRole: 'logo' | 'icon' | 'graphic' | 'generic' =
    mediaTab === 'graphics'
      ? graphicsFilter === 'other'
        ? 'graphic'
        : graphicsFilter
      : 'generic';
  const allowMultipleUpload = activeUploadRole !== 'logo' && activeUploadRole !== 'icon';

  useEffect(() => {
    if (!previewItem) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setPreviewItem(null);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [previewItem]);

  useEffect(() => {
    const validIds = new Set(items.map((item) => item.id));
    setSelectedIds((current) => current.filter((id) => validIds.has(id)));
  }, [items]);

  useEffect(() => {
    setServiceFilter('all');
    setGraphicsFilter('logo');
  }, [mediaTab]);

  function toggleSelected(item: Media) {
    setSelectedIds((current) =>
      current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id]
    );
  }

  async function deleteMediaItems(targetItems: Media[]) {
    if (targetItems.length === 0) return;
    if (!window.confirm(`Delete ${targetItems.length} media item${targetItems.length === 1 ? '' : 's'}?`)) return;

    setError(null);
    setIsDeleting(true);

    try {
      const ids = targetItems.map((item) => item.id);
      const deletedRoleSet = new Set(
        targetItems
          .map((item) => getMediaRoleFromMetadata(item.metadata))
          .filter((value): value is 'logo' | 'icon' => value === 'logo' || value === 'icon'),
      );

      const response = await fetch('/api/media/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids }),
      });

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        const message =
          typeof payload === 'object' &&
          payload !== null &&
          'error' in payload &&
          typeof (payload as { error?: unknown }).error === 'string'
            ? (payload as { error: string }).error
            : 'Delete failed';
        throw new Error(message);
      }

      setItems((current) => current.filter((item) => !ids.includes(item.id)));
      setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
      if (previewItem && ids.includes(previewItem.id)) setPreviewItem(null);
      if (deletedRoleSet.has('logo')) {
        const remainingLogo = sortedItems.find((item) => !ids.includes(item.id) && getMediaRoleFromMetadata(item.metadata) === 'logo');
        setBusinessLogoUrl(remainingLogo?.file_url ?? null);
      }
      if (deletedRoleSet.has('icon')) {
        const remainingIcon = sortedItems.find((item) => !ids.includes(item.id) && getMediaRoleFromMetadata(item.metadata) === 'icon');
        setBusinessFaviconUrl(remainingIcon?.file_url ?? null);
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Delete failed');
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleDeleteSelected() {
    const selectedItems = items.filter((item) => selectedIds.includes(item.id));
    await deleteMediaItems(selectedItems);
  }

  const areAllVisibleItemsSelected =
    filteredSortedItems.length > 0 && filteredSortedItems.every((item) => selectedIds.includes(item.id));

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) return;

    setError(null);
    setIsUploading(true);
    setUploadProgress({ done: 0, total: files.length });
    try {
      const convertedFiles = await prepareFilesForMediaUpload(files, {
        onProgress: (done, total) => setUploadProgress({ done, total }),
      });

      const role = activeUploadRole;
      const singleFileMode = role === 'logo' || role === 'icon';
      const filesForUpload = singleFileMode ? convertedFiles.slice(0, 1) : convertedFiles;
      if (singleFileMode && convertedFiles.length > 1) {
        setError(`${role === 'logo' ? 'Logo' : 'Icon'} upload accepts one file. Using the first selected file.`);
      }

      const { items: insertedItems, failedFiles } = await uploadManagedMedia(filesForUpload, role);

      setUploadProgress({ done: filesForUpload.length, total: filesForUpload.length });

      if (insertedItems.length > 0) {
        setItems((current) => [...insertedItems, ...current]);
        if (role === 'logo') {
          setBusinessLogoUrl(insertedItems[0]?.file_url ?? null);
        }
        if (role === 'icon') {
          setBusinessFaviconUrl(insertedItems[0]?.file_url ?? null);
        }
      }

      if (failedFiles.length > 0) {
        setError(
          `Uploaded ${insertedItems.length} of ${filesForUpload.length}. Failed: ${failedFiles.join(', ')}`
        );
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <ModuleShell
      title="Media Library"
      description="Upload and manage images and files"
      toolbar={
        <div className="media-library__toolbar">
          <BackendTabs
            ariaLabel="Media type"
            activeValue={mediaTab}
            wrap
            items={[
              { value: 'all', label: `All (${allCount})` },
              { value: 'services', label: `Services (${servicesCount})` },
              { value: 'team', label: `Team (${teamCount})` },
              { value: 'graphics', label: `Graphics (${allGraphicsCount})` },
              { value: 'other', label: `Other (${otherCount})` },
            ]}
            onChange={(value) => setMediaTab(value as MediaTab)}
          />
          {mediaTab === 'graphics' && (
            <BackendTabs
              ariaLabel="Graphics media filters"
              activeValue={graphicsFilter}
              className="media-library__subtabs"
              wrap
              items={[
                { value: 'logo', label: `Logo (${logoCount})` },
                { value: 'icon', label: `Favicon (${iconCount})` },
                { value: 'other', label: `Other (${graphicsCount})` },
              ]}
              onChange={(value) => setGraphicsFilter(value as GraphicsFilter)}
            />
          )}
          {mediaTab === 'services' && (
            <BackendTabs
              ariaLabel="Service media filters"
              activeValue={serviceFilter}
              className="media-library__subtabs"
              wrap
              items={[
                { value: 'all', label: `All Services (${servicesCount})` },
                ...serviceTabs.map((serviceTab) => ({
                  value: `service:${serviceTab.id}`,
                  label: `${serviceTab.label} (${serviceTab.count})`,
                })),
              ]}
              onChange={(value) => setServiceFilter(value as ServiceFilter)}
            />
          )}
        </div>
      }
      actions={
        <div className="media-library__header-actions">
          {selectedIds.length > 0 && (
            <button
              type="button"
              className="media-picker__icon-btn media-picker__icon-btn--danger media-picker__icon-btn--flat"
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              title={isDeleting ? 'Deleting...' : `Delete selected (${selectedIds.length})`}
              aria-label={isDeleting ? 'Deleting selected media' : `Delete ${selectedIds.length} selected media items`}
            >
              <DeleteIcon />
            </button>
          )}
          <label className="media-library__select-all">
            <input
              type="checkbox"
              checked={areAllVisibleItemsSelected}
              onChange={(event) =>
                setSelectedIds((current) => {
                  if (!event.target.checked) {
                    const visibleIds = new Set(filteredSortedItems.map((item) => item.id));
                    return current.filter((id) => !visibleIds.has(id));
                  }
                  return Array.from(new Set([...current, ...filteredSortedItems.map((item) => item.id)]));
                })
              }
              aria-label="Select all media"
            />
            <span>Select All</span>
          </label>
          <Button
            type="button"
            variant="btn--primary"
            icon={<UploadIcon />}
            iconPosition="left"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading && uploadProgress
              ? `Uploading ${uploadProgress.done}/${uploadProgress.total}...`
              : activeUploadRole === 'logo'
                ? 'Upload Logo'
                : activeUploadRole === 'icon'
                  ? 'Upload Icon'
                : 'Upload'}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.heic,.heif,image/heic,image/heif,application/pdf"
            multiple={allowMultipleUpload}
            className="media-library__input"
            onChange={handleFileChange}
          />
        </div>
      }
    >
      {error && <p className="form-error">{error}</p>}
      <MediaGrid
        items={filteredSortedItems}
        onItemClick={(item) => setPreviewItem(item as Media)}
        showSelectionCheckboxes
        selectedIds={selectedIds}
        onToggleSelection={(item) => toggleSelected(item as Media)}
      />

      {previewItem && (
        <div className="media-lightbox" onClick={() => setPreviewItem(null)}>
          <div className="media-lightbox__content" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="btn media-lightbox__close" onClick={() => setPreviewItem(null)}>
              Close
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (previewItem) void deleteMediaItems([previewItem]);
              }}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
            {previewItem.file_type.startsWith('image/') ? (
              <>
                <AppImage
                  role="gallery"
                  className="media-lightbox__image"
                  src={previewItem.file_url}
                  alt={previewItem.alt_text || previewItem.file_name}
                  width={1600}
                  height={1200}
                />
                <div className="editor__field-group editor__field-group--mt-3">
                  <label>Used By</label>
                  {(usageByItemId[previewItem.id] ?? []).length > 0 ? (
                    <ul className="service-editor__project-area-list media-lightbox__usage-list">
                      {(usageByItemId[previewItem.id] ?? []).map((ref) => (
                        <li key={`${previewItem.id}-${ref.kind}-${ref.entityId}`} className="service-editor__project-area-option">
                          <strong>{MEDIA_USAGE_KIND_LABELS[ref.kind]}:</strong> {ref.label}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="service-editor__empty">Not currently referenced by a service, team member, page, or other supported record.</p>
                  )}
                </div>
              </>
            ) : (
              <div className="media-lightbox__file">
                <p className="media-lightbox__file-name">{previewItem.file_name}</p>
                <a href={previewItem.file_url} target="_blank" rel="noreferrer">
                  Open file
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </ModuleShell>
  );
}
