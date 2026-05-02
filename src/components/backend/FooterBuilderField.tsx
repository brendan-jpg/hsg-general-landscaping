'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import DeleteIcon from '@/components/shared/icons/DeleteIcon';
import DownIcon from '@/components/shared/icons/DownIcon';
import UpIcon from '@/components/shared/icons/UpIcon';
import MediaPickerField from '@/components/backend/MediaPickerField';
import {
  createDefaultFooterBuilderConfig,
  createFooterColumn,
  createFooterColumnItem,
  createFooterLinkItem,
  parseFooterBuilderConfig,
  type FooterBuilderConfig,
  type FooterColumn,
  type FooterColumnItem,
  type FooterLinkItem,
} from '@/lib/navigation/footerBuilder';

interface PageOption {
  id: string;
  page_kind: string | null;
  slug: string | null;
  title: string | null;
}

interface FooterBuilderFieldProps {
  initialConfig?: FooterBuilderConfig | null;
  pageOptions: PageOption[];
}

const FOOTER_TEXT_TAGS = [
  '{{business_name}}',
  '{{business_phone}}',
  '{{business_email}}',
  '{{business_address}}',
  '{{business_licenses}}',
] as const;

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  return next;
}

export default function FooterBuilderField({ initialConfig, pageOptions }: FooterBuilderFieldProps) {
  const normalizedInitialConfig = useMemo(
    () => parseFooterBuilderConfig(initialConfig ?? createDefaultFooterBuilderConfig()),
    [initialConfig],
  );
  const [config, setConfig] = useState<FooterBuilderConfig>(normalizedInitialConfig);

  const pageChoices = useMemo(
    () =>
      pageOptions
        .filter((page) => page.slug?.trim())
        .map((page) => ({
          value: (page.slug ?? '').trim(),
          label: (page.title ?? page.slug ?? 'Page').trim() || 'Page',
          href: (page.slug ?? '').trim() === 'home' ? '/' : `/${(page.slug ?? '').trim()}`,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [pageOptions],
  );

  const serialized = JSON.stringify(config);

  function updateColumn(columnId: string, updater: (column: FooterColumn) => FooterColumn) {
    setConfig((current) => ({
      ...current,
      columns: current.columns.map((column) => (column.id === columnId ? updater(column) : column)),
    }));
  }

  return (
    <div className="settings__section footer-builder">
      <input type="hidden" name="footer_builder_config" value={serialized} />

      <div className="footer-builder__summary">
        <p className="footer-builder__chips">
          {config.columns.map((column, index) => (
            <span key={column.id} className="footer-builder__chip">
              {column.title || `Column ${index + 1}`}
            </span>
          ))}
        </p>
      </div>

      <div className="footer-builder__columns">
        {config.columns.map((column, columnIndex) => (
          <div key={column.id} className="footer-builder__column" style={{ '--footer-column-index': columnIndex } as CSSProperties}>
            <div className="footer-builder__column-head">
              <div className="footer-builder__column-label">
                <span>{column.title || `Column ${columnIndex + 1}`}</span>
              </div>
              <div className="footer-builder__column-actions">
                <button type="button" className="btn header-nav-item__icon-btn" onClick={() => setConfig((current) => ({ ...current, columns: moveItem(current.columns, columnIndex, -1) }))} disabled={columnIndex === 0} aria-label="Move column up" title="Move left">
                  <UpIcon />
                </button>
                <button type="button" className="btn header-nav-item__icon-btn" onClick={() => setConfig((current) => ({ ...current, columns: moveItem(current.columns, columnIndex, 1) }))} disabled={columnIndex === config.columns.length - 1} aria-label="Move column down" title="Move right">
                  <DownIcon />
                </button>
                <button type="button" className="btn header-nav-item__icon-btn" onClick={() => setConfig((current) => ({ ...current, columns: current.columns.filter((entry) => entry.id !== column.id) }))} aria-label="Remove column" title="Remove column">
                  <DeleteIcon />
                </button>
              </div>
            </div>

            <label className="footer-builder__field footer-builder__field--full">
              <span>Column Title</span>
              <input
                type="text"
                value={column.title}
                onChange={(event) =>
                  updateColumn(column.id, (current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder={`Column ${columnIndex + 1}`}
              />
            </label>

            <div className="footer-builder__items">
              {column.items.map((item, itemIndex) => (
                <FooterColumnItemEditor
                  key={item.id}
                  item={item}
                  pageChoices={pageChoices}
                  index={itemIndex}
                  siblingCount={column.items.length}
                  onChange={(nextItem) =>
                    updateColumn(column.id, (current) => ({
                      ...current,
                      items: current.items.map((entry) => (entry.id === item.id ? nextItem : entry)),
                    }))
                  }
                  onDelete={() =>
                    updateColumn(column.id, (current) => ({
                      ...current,
                      items: current.items.filter((entry) => entry.id !== item.id),
                    }))
                  }
                  onMove={(direction) =>
                    updateColumn(column.id, (current) => ({
                      ...current,
                      items: moveItem(current.items, itemIndex, direction),
                    }))
                  }
                />
              ))}
            </div>

            <div className="footer-builder__item-actions">
              <button
                type="button"
                className="btn"
                onClick={() =>
                  updateColumn(column.id, (current) => ({
                    ...current,
                    items: [...current.items, createFooterColumnItem('text')],
                  }))
                }
              >
                Add Text
              </button>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  updateColumn(column.id, (current) => ({
                    ...current,
                    items: [...current.items, createFooterColumnItem('links')],
                  }))
                }
              >
                Add Links
              </button>
              <button
                type="button"
                className="btn"
                onClick={() =>
                  updateColumn(column.id, (current) => ({
                    ...current,
                    items: [...current.items, createFooterColumnItem('media')],
                  }))
                }
              >
                Add Media
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="footer-builder__actions">
        <button
          type="button"
          className="btn"
          onClick={() =>
            setConfig((current) => ({
              ...current,
              columns: [...current.columns, createFooterColumn({ title: `Column ${current.columns.length + 1}` })],
            }))
          }
        >
          Add Column
        </button>
        <button type="button" className="btn" onClick={() => setConfig(createDefaultFooterBuilderConfig())}>
          Reset Builder
        </button>
      </div>
    </div>
  );
}

function FooterColumnItemEditor({
  item,
  pageChoices,
  index,
  siblingCount,
  onChange,
  onDelete,
  onMove,
}: {
  item: FooterColumnItem;
  pageChoices: Array<{ value: string; label: string; href: string }>;
  index: number;
  siblingCount: number;
  onChange: (next: FooterColumnItem) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <div className="footer-builder__item">
      <div className="footer-builder__item-head">
        <label className="footer-builder__field">
          <span>Content Type</span>
          <select
            value={item.type}
            onChange={(event) => onChange(createFooterColumnItem(event.target.value as FooterColumnItem['type'], item))}
          >
            <option value="text">Text</option>
            <option value="links">Links</option>
            <option value="media">Media</option>
          </select>
        </label>
        <div className="footer-builder__column-actions">
          <button type="button" className="btn header-nav-item__icon-btn" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move item up" title="Move up">
            <UpIcon />
          </button>
          <button type="button" className="btn header-nav-item__icon-btn" onClick={() => onMove(1)} disabled={index === siblingCount - 1} aria-label="Move item down" title="Move down">
            <DownIcon />
          </button>
          <button type="button" className="btn header-nav-item__icon-btn" onClick={onDelete} aria-label="Remove item" title="Remove item">
            <DeleteIcon />
          </button>
        </div>
      </div>

      {item.type === 'text' && (
        <div className="footer-builder__item-fields footer-builder__item-fields--text">
          <label className="footer-builder__field">
            <span>Heading</span>
            <input type="text" value={item.heading} onChange={(event) => onChange({ ...item, heading: event.target.value })} />
          </label>
          <label className="footer-builder__field footer-builder__field--full">
            <span>Body</span>
            <textarea rows={5} value={item.body} onChange={(event) => onChange({ ...item, body: event.target.value })} />
          </label>
          <div className="footer-builder__tag-row">
            {FOOTER_TEXT_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                className="btn"
                onClick={() => onChange({ ...item, body: item.body ? `${item.body}\n${tag}` : tag })}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {item.type === 'links' && (
        <div className="footer-builder__item-fields footer-builder__item-fields--links">
          <label className="footer-builder__field footer-builder__field--full">
            <span>Heading</span>
            <input type="text" value={item.heading} onChange={(event) => onChange({ ...item, heading: event.target.value })} />
          </label>
          <div className="footer-builder__link-list">
            {item.links.map((link, linkIndex) => (
              <FooterLinkEditor
                key={link.id}
                link={link}
                pageChoices={pageChoices}
                index={linkIndex}
                siblingCount={item.links.length}
                onChange={(nextLink) =>
                  onChange({
                    ...item,
                    links: item.links.map((entry) => (entry.id === link.id ? nextLink : entry)),
                  })
                }
                onDelete={() =>
                  onChange({
                    ...item,
                    links: item.links.filter((entry) => entry.id !== link.id),
                  })
                }
                onMove={(direction) =>
                  onChange({
                    ...item,
                    links: moveItem(item.links, linkIndex, direction),
                  })
                }
              />
            ))}
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => onChange({ ...item, links: [...item.links, createFooterLinkItem()] })}
          >
            Add Link
          </button>
        </div>
      )}

      {item.type === 'media' && (
        <div className="footer-builder__item-fields footer-builder__item-fields--media">
          <label className="footer-builder__field footer-builder__field--full">
            <span>Heading</span>
            <input type="text" value={item.heading} onChange={(event) => onChange({ ...item, heading: event.target.value })} />
          </label>
          <div className="footer-builder__media-grid">
            {[0, 1].map((slot) => (
              <div key={`${item.id}-image-${slot}`} className="footer-builder__media-field">
                <span className="footer-builder__media-label">Image {slot + 1}</span>
                <MediaPickerField
                  value={item.images[slot] ?? ''}
                  onChange={(value) => {
                    const nextImages = [...item.images];
                    nextImages[slot] = value;
                    onChange({ ...item, images: nextImages.filter((entry, index) => entry || index === 0 || nextImages[index + 1]) });
                  }}
                  allowUpload
                  uploadRole="generic"
                  hideLabel
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FooterLinkEditor({
  link,
  pageChoices,
  index,
  siblingCount,
  onChange,
  onDelete,
  onMove,
}: {
  link: FooterLinkItem;
  pageChoices: Array<{ value: string; label: string; href: string }>;
  index: number;
  siblingCount: number;
  onChange: (next: FooterLinkItem) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <div className="footer-builder__link-item">
      <label className="footer-builder__field">
        <span>Label</span>
        <input type="text" value={link.label} onChange={(event) => onChange({ ...link, label: event.target.value })} />
      </label>
      <label className="footer-builder__field">
        <span>Page</span>
        <select
          value={link.sourcePageSlug ?? ''}
          onChange={(event) => {
            const selected = pageChoices.find((choice) => choice.value === event.target.value) ?? null;
            onChange({
              ...link,
              sourcePageSlug: event.target.value || null,
              href: selected?.href ?? link.href,
              label: link.label || selected?.label || '',
            });
          }}
        >
          <option value="">Custom URL</option>
          {pageChoices.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      </label>
      <label className="footer-builder__field footer-builder__field--full">
        <span>URL</span>
        <input type="text" value={link.href} onChange={(event) => onChange({ ...link, href: event.target.value })} />
      </label>
      <div className="footer-builder__column-actions">
        <button type="button" className="btn header-nav-item__icon-btn" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move link up" title="Move up">
          <UpIcon />
        </button>
        <button type="button" className="btn header-nav-item__icon-btn" onClick={() => onMove(1)} disabled={index === siblingCount - 1} aria-label="Move link down" title="Move down">
          <DownIcon />
        </button>
        <button type="button" className="btn header-nav-item__icon-btn" onClick={onDelete} aria-label="Remove link" title="Remove link">
          <DeleteIcon />
        </button>
      </div>
    </div>
  );
}
