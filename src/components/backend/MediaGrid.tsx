import AppImage from '@/components/shared/AppImage';

interface MediaItem {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size?: number | null;
  alt_text?: string | null;
  variants?: unknown;
}

interface MediaGridProps {
  view?: 'grid' | 'list';
  items: MediaItem[];
  selectable?: boolean;
  onSelect?: (item: MediaItem) => void;
  onItemClick?: (item: MediaItem) => void;
  selectionMode?: boolean;
  showSelectionCheckboxes?: boolean;
  selectedIds?: string[];
  onToggleSelection?: (item: MediaItem) => void;
  onDeleteItem?: (item: MediaItem) => void;
}

export default function MediaGrid({
  view,
  items,
  selectable,
  onSelect,
  onItemClick,
  selectionMode = false,
  showSelectionCheckboxes = false,
  selectedIds = [],
  onToggleSelection,
  onDeleteItem,
}: MediaGridProps) {
  const selectedSet = new Set(selectedIds);

  function getPreviewUrl(item: MediaItem) {
    if (!item.file_type.startsWith('image/')) return item.file_url;
    if (!Array.isArray(item.variants)) return item.file_url;

    type Variant = {
      url?: unknown;
      width?: unknown;
      bytes?: unknown;
      contentType?: unknown;
    };

    const variants = (item.variants as Variant[])
      .filter((variant) => typeof variant?.url === 'string' && variant.url)
      .sort((a, b) => {
        const widthA = typeof a.width === 'number' ? a.width : Number.MAX_SAFE_INTEGER;
        const widthB = typeof b.width === 'number' ? b.width : Number.MAX_SAFE_INTEGER;
        if (widthA !== widthB) return widthA - widthB;

        const bytesA = typeof a.bytes === 'number' ? a.bytes : Number.MAX_SAFE_INTEGER;
        const bytesB = typeof b.bytes === 'number' ? b.bytes : Number.MAX_SAFE_INTEGER;
        return bytesA - bytesB;
      });

    return (variants[0]?.url as string | undefined) ?? item.file_url;
  }

  if (items.length === 0) {
    return (
      <div className="media-grid__empty">
        <p>No media uploaded yet</p>
      </div>
    );
  }

  return (
    <div className="media-grid media-grid--grid">
      {items.map(item => (
        <div
          key={item.id}
          className={`media-grid__item ${selectionMode && selectedSet.has(item.id) ? 'media-grid__item--selected' : ''}`}
          onClick={() => {
            if (selectionMode) {
              onToggleSelection?.(item);
              return;
            }
            if (selectable) {
              onSelect?.(item);
              return;
            }
            onItemClick?.(item);
          }}
        >
          {((selectionMode || showSelectionCheckboxes) || onDeleteItem) && (
            <div className="media-grid__actions" onClick={(event) => event.stopPropagation()}>
              {(selectionMode || showSelectionCheckboxes) && (
                <label className="media-grid__checkbox">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(item.id)}
                    onChange={() => onToggleSelection?.(item)}
                  />
                </label>
              )}
              {onDeleteItem && (
                <button
                  type="button"
                  className="media-grid__delete-btn"
                  onClick={() => onDeleteItem(item)}
                  aria-label={`Delete ${item.file_name}`}
                >
                  Delete
                </button>
              )}
            </div>
          )}
          {item.file_type.startsWith('image/') ? (
            <div className="media-grid__thumb">
              <AppImage
                role="gallery"
                src={getPreviewUrl(item)}
                alt={item.alt_text || item.file_name}
                width={480}
                height={360}
              />
            </div>
          ) : (
            <div className="media-grid__file-icon">{/* File type icon */}</div>
          )}
          <span className="media-grid__name">{item.file_name}</span>
        </div>
      ))}
    </div>
  );
}
