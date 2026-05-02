'use client';

import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BackendTabs from '@/components/backend/BackendTabs';
import MediaGrid from '@/components/backend/MediaGrid';
import AppImage from '@/components/shared/AppImage';
import DeleteIcon from '@/components/shared/icons/DeleteIcon';
import EditIcon from '@/components/shared/icons/EditIcon';
import { prepareFilesForMediaUpload } from '@/lib/media/clientUpload';
import { isIconMedia, isLogoMedia } from '@/lib/media/roles';
import type { MediaUsageKind, MediaUsageReference } from '@/lib/media/queries';
import type { Tables } from '@/lib/types/database';

type Media = Tables<'media'>;
type PickerCategory = 'all' | 'graphics' | 'logo' | 'icon' | 'services' | 'team';
type PickerServiceFilter = 'all' | `service:${string}`;

interface MediaPickerFieldProps {
  className?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  items?: Media[];
  usageByUrl?: Record<string, MediaUsageReference[]>;
  mediaTab?: 'all' | 'logo' | 'icon' | 'graphics';
  allowUpload?: boolean;
  uploadRole?: 'hero' | 'logo' | 'icon' | 'card' | 'content' | 'gallery' | 'avatar' | 'graphic' | 'generic';
  maxUploadFiles?: number;
  showSelectedActions?: boolean;
  showChangeAction?: boolean;
  selectedThumbAspect?: 'default' | 'square';
  hideLabel?: boolean;
  hidePlaceholderText?: boolean;
}

const PICKER_PAGE_SIZE = 25;

interface MediaListResponse {
  items: Media[];
  hasMore: boolean;
  total?: number;
  error?: string;
}

const SERVICE_USAGE_KINDS: MediaUsageKind[] = ['service', 'service_gallery'];

export default function MediaPickerField({
  className,
  label = 'Image',
  value,
  onChange,
  items,
  usageByUrl = {},
  mediaTab = 'all',
  allowUpload = false,
  uploadRole = 'generic',
  maxUploadFiles = 10,
  showSelectedActions = true,
  showChangeAction = true,
  selectedThumbAspect = 'default',
  hideLabel = false,
  hidePlaceholderText = false,
}: MediaPickerFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PICKER_PAGE_SIZE);
  const [hasMoreRemote, setHasMoreRemote] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedItems, setLoadedItems] = useState<Media[]>(() => items ?? []);
  const [category, setCategory] = useState<PickerCategory>(() => {
    if (mediaTab === 'all') return 'all';
    if (mediaTab === 'logo') return 'logo';
    if (mediaTab === 'icon') return 'icon';
    return 'graphics';
  });
  const [serviceFilter, setServiceFilter] = useState<PickerServiceFilter>('all');
  const isGraphicsMedia = useCallback((item: Media) => {
    if (isLogoMedia(item) || isIconMedia(item)) return false;
    const refs = usageByUrl[item.file_url] ?? [];
    if (refs.some((ref) => ref.kind === 'team_member')) return false;
    if (refs.some((ref) => SERVICE_USAGE_KINDS.includes(ref.kind))) return false;
    return true;
  }, [usageByUrl]);

  const pickerItems = useMemo(
    () =>
      [...loadedItems]
        .filter((item) => {
          if (mediaTab === 'logo') return isLogoMedia(item);
          if (mediaTab === 'icon') return isIconMedia(item);
          if (mediaTab === 'graphics') return isGraphicsMedia(item);
          return true;
        })
        .filter((item) => item.file_type.startsWith('image/'))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [isGraphicsMedia, loadedItems, mediaTab],
  );
  const logoCount = useMemo(() => pickerItems.filter((item) => isLogoMedia(item)).length, [pickerItems]);
  const iconCount = useMemo(() => pickerItems.filter((item) => isIconMedia(item)).length, [pickerItems]);
  const graphicsCount = useMemo(
    () => pickerItems.filter((item) => isGraphicsMedia(item)).length,
    [isGraphicsMedia, pickerItems],
  );
  const servicesCount = useMemo(
    () =>
      pickerItems.filter((item) => {
        const refs = usageByUrl[item.file_url] ?? [];
        return refs.some((ref) => SERVICE_USAGE_KINDS.includes(ref.kind));
      }).length,
    [pickerItems, usageByUrl],
  );
  const teamCount = useMemo(
    () =>
      pickerItems.filter((item) => {
        const refs = usageByUrl[item.file_url] ?? [];
        return refs.some((ref) => ref.kind === 'team_member');
      }).length,
    [pickerItems, usageByUrl],
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
        if (current) {
          current.urls.add(url);
        } else {
          byService.set(ref.entityId, { id: ref.entityId, label: ref.label || 'Service', urls: new Set([url]) });
        }
      }
    }
    return Array.from(byService.values())
      .map((row) => ({ id: row.id, label: row.label, count: row.urls.size }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [usageByUrl]);
  const categoryTabs = useMemo(() => {
    const items: Array<{ value: PickerCategory; label: string }> = [];
    items.push({ value: 'all', label: `All (${pickerItems.length})` });
    if (graphicsCount > 0 || category === 'graphics') items.push({ value: 'graphics', label: `Graphics (${graphicsCount})` });
    if (servicesCount > 0 || category === 'services') items.push({ value: 'services', label: `Services (${servicesCount})` });
    if (teamCount > 0 || category === 'team') items.push({ value: 'team', label: `Team (${teamCount})` });
    if (logoCount > 0 || category === 'logo') items.push({ value: 'logo', label: `Logo (${logoCount})` });
    if (iconCount > 0 || category === 'icon') items.push({ value: 'icon', label: `Icon (${iconCount})` });
    return items;
  }, [category, graphicsCount, iconCount, logoCount, pickerItems.length, servicesCount, teamCount]);
  const filteredItems = useMemo(() => {
    if (category === 'all') {
      return pickerItems;
    }
    if (category === 'logo') {
      return pickerItems.filter((item) => isLogoMedia(item));
    }
    if (category === 'graphics') {
      return pickerItems.filter((item) => isGraphicsMedia(item));
    }
    if (category === 'team') {
      return pickerItems.filter((item) => {
        const refs = usageByUrl[item.file_url] ?? [];
        return refs.some((ref) => ref.kind === 'team_member');
      });
    }
    if (category === 'icon') {
      return pickerItems.filter((item) => isIconMedia(item));
    }
    let serviceItems = pickerItems.filter((item) => {
      const refs = usageByUrl[item.file_url] ?? [];
      return refs.some((ref) => SERVICE_USAGE_KINDS.includes(ref.kind));
    });
    if (serviceFilter.startsWith('service:')) {
      const serviceId = serviceFilter.slice('service:'.length);
      serviceItems = serviceItems.filter((item) => {
        const refs = usageByUrl[item.file_url] ?? [];
        return refs.some((ref) => SERVICE_USAGE_KINDS.includes(ref.kind) && ref.entityId === serviceId);
      });
    }
    return serviceItems;
  }, [category, isGraphicsMedia, pickerItems, serviceFilter, usageByUrl]);
  const visibleItems = useMemo(() => filteredItems.slice(0, visibleCount), [filteredItems, visibleCount]);

  useEffect(() => {
    if (!items) return;
    setLoadedItems(items);
    setHasMoreRemote(items.length >= PICKER_PAGE_SIZE);
  }, [items]);

  useEffect(() => {
    if (items) return;

    let isActive = true;

    async function loadMedia() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/media/list?imagesOnly=true&limit=${PICKER_PAGE_SIZE}&offset=0`);
        const payload = (await response.json()) as MediaListResponse;
        if (!response.ok) throw new Error(payload?.error || 'Failed to load media');
        if (!isActive) return;
        setLoadedItems(payload.items ?? []);
        setHasMoreRemote(Boolean(payload.hasMore));
      } catch (loadError) {
        if (isActive) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load media');
        }
      } finally {
        if (isActive) setLoading(false);
      }
    }

    loadMedia();
    return () => {
      isActive = false;
    };
  }, [items, mediaTab]);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setVisibleCount(PICKER_PAGE_SIZE);
    setServiceFilter('all');
    if (mediaTab === 'all') setCategory('all');
    else if (mediaTab === 'logo') setCategory('logo');
    else if (mediaTab === 'icon') setCategory('icon');
    else if (mediaTab === 'graphics') setCategory('graphics');
    else setCategory('all');
  }, [isOpen, mediaTab]);

  useEffect(() => {
    if (mediaTab === 'all') setCategory('all');
    else if (mediaTab === 'logo') setCategory('logo');
    else if (mediaTab === 'icon') setCategory('icon');
    else if (mediaTab === 'graphics') setCategory('graphics');
  }, [mediaTab]);

  const handleLoadMore = useCallback(async () => {
    if (filteredItems.length > visibleItems.length) {
      setVisibleCount((current) => current + PICKER_PAGE_SIZE);
      return;
    }
    if (!hasMoreRemote || isLoadingMore) return;

    setIsLoadingMore(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/media/list?imagesOnly=true&limit=${PICKER_PAGE_SIZE}&offset=${loadedItems.length}`,
      );
      const payload = (await response.json()) as MediaListResponse;
      if (!response.ok) throw new Error(payload?.error || 'Failed to load more media');

      setLoadedItems((current) => {
        const byId = new Map(current.map((item) => [item.id, item]));
        for (const item of payload.items ?? []) byId.set(item.id, item);
        return Array.from(byId.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      });
      setHasMoreRemote(Boolean(payload.hasMore));
      setVisibleCount((current) => current + PICKER_PAGE_SIZE);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load more media');
    } finally {
      setIsLoadingMore(false);
    }
  }, [filteredItems.length, hasMoreRemote, isLoadingMore, loadedItems.length, visibleItems.length]);

  useEffect(() => {
    if (!isOpen) return;
    if (category !== 'services') return;
    if (!serviceFilter.startsWith('service:')) return;
    const activeServiceTab = serviceTabs.find((tab) => `service:${tab.id}` === serviceFilter);
    if (!activeServiceTab || activeServiceTab.count <= 0) return;
    if (filteredItems.length > 0) return;
    if (!hasMoreRemote || isLoadingMore || loading) return;
    void handleLoadMore();
  }, [category, filteredItems.length, handleLoadMore, hasMoreRemote, isLoadingMore, isOpen, loading, serviceFilter, serviceTabs]);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) return;

    const cappedFiles = files.slice(0, Math.max(1, maxUploadFiles));
    setUploading(true);
    setError(null);

    try {
      const preparedFiles = await prepareFilesForMediaUpload(cappedFiles);
      const formData = new FormData();
      for (const file of preparedFiles) {
        formData.append('files', file, file.name);
      }
      formData.append('role', uploadRole);

      const response = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      const payload = (await response.json()) as { items?: Media[]; error?: string };
      if (!response.ok) throw new Error(payload?.error || 'Upload failed');
      const insertedItems = payload.items ?? [];

      if (insertedItems.length > 0) {
        setLoadedItems((current) => {
          const byId = new Map(current.map((item) => [item.id, item]));
          for (const item of insertedItems) byId.set(item.id, item);
          return Array.from(byId.values()).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          );
        });
        onChange(insertedItems[0].file_url);
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const canChooseCategory = mediaTab === 'all';

  return (
    <div className={['editor__field-group', className].filter(Boolean).join(' ')}>
      {!hideLabel && <label>{label}</label>}
      <div className="media-picker__selected">
        {value ? (
          <div className="media-picker__selected-frame">
            {showSelectedActions ? (
              <>
                <AppImage
                  className={[
                    'media-picker__selected-thumb',
                    selectedThumbAspect === 'square' ? 'media-picker__selected-thumb--square' : '',
                  ].filter(Boolean).join(' ')}
                  role="gallery"
                  src={value}
                  alt="Selected media"
                  width={600}
                  height={400}
                />
                <div className="media-picker__selected-actions" aria-label="Image actions">
                  {showChangeAction ? (
                    <button
                      className="media-picker__icon-btn"
                      type="button"
                      onClick={() => setIsOpen(true)}
                      title="Change image"
                      aria-label="Change image"
                    >
                      <EditIcon />
                    </button>
                  ) : null}
                  <button
                    className="media-picker__icon-btn media-picker__icon-btn--danger"
                    type="button"
                    onClick={() => onChange('')}
                    title="Remove image"
                    aria-label="Remove image"
                  >
                    <DeleteIcon />
                  </button>
                </div>
              </>
            ) : (
              <button
                className={[
                  'media-picker__selected-thumb',
                  'media-picker__selected-thumb--button',
                  selectedThumbAspect === 'square' ? 'media-picker__selected-thumb--square' : '',
                ].filter(Boolean).join(' ')}
                type="button"
                onClick={() => setIsOpen(true)}
                aria-label="Change image"
                title="Change image"
              >
                <AppImage
                  className={[
                    'media-picker__selected-thumb',
                    selectedThumbAspect === 'square' ? 'media-picker__selected-thumb--square' : '',
                  ].filter(Boolean).join(' ')}
                  role="gallery"
                  src={value}
                  alt="Selected media"
                  width={600}
                  height={400}
                />
              </button>
            )}
          </div>
        ) : (
          <button
            className={[
              'media-picker__selected-thumb',
              'media-picker__selected-thumb--placeholder',
              'media-picker__selected-thumb--button',
              selectedThumbAspect === 'square' ? 'media-picker__selected-thumb--square' : '',
            ].filter(Boolean).join(' ')}
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="Choose image from library"
            title="Choose image"
          >
            <span className="media-picker__placeholder-icon">+</span>
            {!hidePlaceholderText && <span className="media-picker__placeholder-text">Choose image</span>}
          </button>
        )}
      </div>
      {isOpen && (
        <div className="media-picker__overlay" onClick={() => setIsOpen(false)}>
            <div className="media-picker__modal" onClick={(event) => event.stopPropagation()}>
              <div className="media-picker__header">
                <div className="media-picker__title-wrap">
                  <h3 className="media-picker__title">{label}</h3>
                  <span className="media-picker__count">
                    {visibleItems.length} of {filteredItems.length} images
                  </span>
                </div>
                <div className="media-picker__header-main">
                  {canChooseCategory && (
                    <BackendTabs
                      ariaLabel={`${label} media categories`}
                      activeValue={category}
                      className="media-picker__filters"
                      wrap
                      items={categoryTabs}
                      onChange={(value) => setCategory(value as PickerCategory)}
                    />
                  )}
                  {category === 'services' && (
                    <BackendTabs
                      ariaLabel={`${label} service filters`}
                      activeValue={serviceFilter}
                      className="media-picker__filters media-picker__filters--sub"
                      wrap
                      items={[
                        { value: 'all', label: `All Services (${servicesCount})` },
                        ...serviceTabs.map((serviceTab) => ({
                          value: `service:${serviceTab.id}`,
                          label: `${serviceTab.label} (${serviceTab.count})`,
                        })),
                      ]}
                      onChange={(value) => setServiceFilter(value as PickerServiceFilter)}
                    />
                  )}
                </div>
                <div className="media-picker__header-actions">
                  {allowUpload && (
                    <>
                      <button
                        className="media-picker__header-btn media-picker__header-btn--primary"
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        disabled={uploading}
                        aria-label={uploading ? 'Uploading' : 'Upload'}
                        title={uploading ? 'Uploading' : 'Upload'}
                      >
                        <UploadIcon />
                        <span>{uploading ? 'Uploading...' : 'Upload'}</span>
                      </button>
                      <input
                        ref={inputRef}
                      type="file"
                      accept="image/*,.heic,.heif,image/heic,image/heif"
                      multiple={maxUploadFiles > 1}
                      onChange={handleUpload}
                      style={{ display: 'none' }}
                    />
                    </>
                  )}
                  <button
                    className="media-picker__header-btn media-picker__header-btn--secondary media-picker__header-btn--icon-only"
                    type="button"
                    onClick={() => setIsOpen(false)}
                    aria-label="Close"
                    title="Close"
                  >
                    <CloseIcon />
                  </button>
                </div>
              </div>
            <div className="media-picker__body">
              {loading ? (
                <p>Loading media...</p>
              ) : (
                <MediaGrid
                  view="grid"
                  items={visibleItems.map((item) => ({
                    id: item.id,
                    file_name: item.file_name,
                    file_url: item.file_url,
                    file_type: item.file_type,
                    file_size: item.file_size ?? undefined,
                    alt_text: item.alt_text ?? undefined,
                    variants: item.variants ?? undefined,
                  }))}
                  selectable
                  onSelect={(item) => {
                    onChange(item.file_url);
                    setIsOpen(false);
                  }}
                />
              )}
            </div>
            {!loading && (filteredItems.length > visibleItems.length || hasMoreRemote) && (
              <div className="media-picker__footer">
                <button
                  className="btn"
                  type="button"
                  onClick={() => void handleLoadMore()}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore
                    ? 'Loading...'
                    : filteredItems.length > visibleItems.length
                      ? `Load More (${filteredItems.length - visibleItems.length} remaining)`
                      : 'Load More from Library'}
                </button>
              </div>
            )}
            {error && <p className="form-error">{error}</p>}
          </div>
        </div>
      )}
    </div>
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


