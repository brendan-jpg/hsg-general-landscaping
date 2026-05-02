'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import DownIcon from '@/components/shared/icons/DownIcon';
import DeleteIcon from '@/components/shared/icons/DeleteIcon';
import UpIcon from '@/components/shared/icons/UpIcon';
import { isProtectedPage, REQUIRED_DASHBOARD_PAGES } from '@/lib/content/pageConfig';
import {
  createHeaderNavItem,
  parseHeaderNavConfig,
  type HeaderNavConfig,
  type HeaderNavConfigItem,
} from '@/lib/navigation/headerNavigation';

interface ServiceOption {
  id: string;
  title: string;
  parent_service_id: string | null;
}

interface PageOption {
  id: string;
  page_kind: string | null;
  slug: string | null;
  title: string | null;
}

interface HeaderNavBuilderFieldProps {
  initialConfig: HeaderNavConfig;
  serviceOptions: ServiceOption[];
  pageOptions: PageOption[];
}

interface ManagedPage {
  slug: string;
  title: string;
  href: string;
  isProtected: boolean;
}

type ItemUpdater = (item: HeaderNavConfigItem) => HeaderNavConfigItem;

const MANAGED_NAV_SLUGS = ['home', 'services', 'service-areas', 'about', 'blog', 'contact'] as const;

function defaultChildrenSourceForSlug(slug: string): HeaderNavConfigItem['childrenSource'] {
  if (slug === 'services') return 'services';
  if (slug === 'service-areas') return 'areas';
  return 'none';
}

function defaultMenuStyleForSlug(slug: string): HeaderNavConfigItem['menuStyle'] {
  return slug === 'services' ? 'mega' : 'dropdown';
}

function slugToHref(slug: string): string {
  return slug === 'home' ? '/' : `/${slug}`;
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  return next;
}

function updateItemById(items: HeaderNavConfigItem[], itemId: string, updater: ItemUpdater): HeaderNavConfigItem[] {
  return items.map((item) => {
    if (item.id === itemId) return updater(item);
    if (item.children.length === 0) return item;
    return { ...item, children: updateItemById(item.children, itemId, updater) };
  });
}

function removeItemById(items: HeaderNavConfigItem[], itemId: string): HeaderNavConfigItem[] {
  return items
    .filter((item) => item.id !== itemId)
    .map((item) => ({ ...item, children: removeItemById(item.children, itemId) }));
}

function buildManagedPages(pageOptions: PageOption[]): ManagedPage[] {
  const pageByKey = new Map(
    pageOptions
      .map((page) => ({
        pageKind: page.page_kind?.trim() || null,
        slug: (page.slug ?? '').trim().toLowerCase(),
        title: (page.title ?? '').trim(),
      }))
      .filter((page) => page.slug)
      .map((page) => [page.pageKind ?? page.slug, page]),
  );

  return MANAGED_NAV_SLUGS.flatMap((slug) => {
    const required = REQUIRED_DASHBOARD_PAGES.find((page) => page.slug === slug) ?? null;
    const dbPage = pageByKey.get(required?.pageKind ?? slug);

    if (!dbPage && !required && slug !== 'about') return [];

    return [
      {
        slug,
        title: dbPage?.title || required?.title || slug.replace(/-/g, ' '),
        href: slugToHref(dbPage?.slug || slug),
        isProtected: isProtectedPage({ slug, page_kind: required?.pageKind ?? null }),
      },
    ];
  });
}

export default function HeaderNavBuilderField({ initialConfig, serviceOptions, pageOptions }: HeaderNavBuilderFieldProps) {
  const parentServiceOptions = useMemo(
    () => serviceOptions.filter((service) => !service.parent_service_id),
    [serviceOptions],
  );
  const managedPages = useMemo(() => buildManagedPages(pageOptions), [pageOptions]);
  const managedPagesBySlug = useMemo(() => new Map(managedPages.map((page) => [page.slug, page])), [managedPages]);
  const [config, setConfig] = useState<HeaderNavConfig>(() => parseHeaderNavConfig(initialConfig));

  const serialized = JSON.stringify(config);

  return (
    <div className="settings__section header-nav-builder">
      <input type="hidden" name="header_navigation_config" value={serialized} />

      <div className="header-nav-builder__summary">
        <p className="header-nav-builder__chips">
          {managedPages.map((page) => (
            <span key={page.slug} className="header-nav-builder__chip">
              {page.title}
            </span>
          ))}
        </p>
      </div>

      <div className="header-nav-builder__list">
        {config.items.map((item, index) => (
          <NavItemEditor
            key={item.id}
            item={item}
            depth={0}
            index={index}
            siblingCount={config.items.length}
            parentServiceOptions={parentServiceOptions}
            managedPagesBySlug={managedPagesBySlug}
            onChange={(nextItem) =>
              setConfig((current) => ({ ...current, items: updateItemById(current.items, item.id, () => nextItem) }))
            }
            onDelete={() => setConfig((current) => ({ ...current, items: removeItemById(current.items, item.id) }))}
            onMove={(direction) =>
              setConfig((current) => ({ ...current, items: moveItem(current.items, index, direction) }))
            }
            onAddChild={() =>
              setConfig((current) => ({
                ...current,
                items: updateItemById(current.items, item.id, (existing) => ({
                  ...existing,
                  children: [...existing.children, createHeaderNavItem({ label: 'Child Item', href: '' })],
                })),
              }))
            }
          />
        ))}
      </div>

      <div className="header-nav-builder__actions">
        <button
          type="button"
          className="btn"
          onClick={() =>
            setConfig((current) => ({
              ...current,
              items: [...current.items, createHeaderNavItem({ label: 'New Item', href: '' })],
            }))
          }
        >
          Add Custom Item
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => setConfig(parseHeaderNavConfig({ items: [] }))}
        >
          Reset Builder
        </button>
      </div>
    </div>
  );
}

interface NavItemEditorProps {
  item: HeaderNavConfigItem;
  depth: number;
  index: number;
  siblingCount: number;
  parentServiceOptions: ServiceOption[];
  managedPagesBySlug: Map<string, ManagedPage>;
  onChange: (next: HeaderNavConfigItem) => void;
  onDelete: () => void;
  onMove: (direction: -1 | 1) => void;
  onAddChild: () => void;
}

function NavItemEditor({
  item,
  depth,
  index,
  siblingCount,
  parentServiceOptions,
  managedPagesBySlug,
  onChange,
  onDelete,
  onMove,
  onAddChild,
}: NavItemEditorProps) {
  const canNestMore = depth < 1;
  const usesAutoParentHref = item.childrenSource === 'service_children';
  const linkedPage = item.sourcePageSlug ? managedPagesBySlug.get(item.sourcePageSlug) : undefined;
  const canDelete = true;

  return (
    <div className="header-nav-item" style={{ '--nav-depth': depth } as CSSProperties}>
      <div className="header-nav-item__fields">
        <label>
          Label
          <input
            type="text"
            value={item.label}
            onChange={(event) => onChange({ ...item, label: event.target.value })}
            placeholder="Menu label"
          />
        </label>
        <label>
          URL
          <input
            type="text"
            value={item.href}
            onChange={(event) => onChange({ ...item, href: event.target.value })}
            placeholder={usesAutoParentHref ? 'Auto from selected parent service' : 'Leave blank for dropdown label only'}
            disabled={usesAutoParentHref}
          />
        </label>
        <label>
          Style
          <select
            value={item.style}
            onChange={(event) => onChange({ ...item, style: event.target.value === 'cta' ? 'cta' : 'link' })}
          >
            <option value="link">Link</option>
            <option value="cta">CTA</option>
          </select>
        </label>
        <label className="header-nav-item__children-source">
          Children Source
          <select
            value={item.childrenSource}
            onChange={(event) =>
              onChange({
                ...item,
                childrenSource: event.target.value as HeaderNavConfigItem['childrenSource'],
                sourceServiceId: event.target.value === 'service_children' ? item.sourceServiceId : null,
                sourceServiceIds: event.target.value === 'service_groups' ? item.sourceServiceIds : [],
              })
            }
          >
            <option value="none">Manual / None</option>
            <option value="services">All Services</option>
            <option value="service_groups">Selected Parent Service Groups</option>
            <option value="areas">All Areas</option>
            <option value="service_children">Children of Service Parent</option>
          </select>
        </label>
        <div className="header-nav-item__head-actions">
          <button
            type="button"
            className="btn header-nav-item__icon-btn"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label="Move item up"
            title="Move up"
          >
            <UpIcon />
          </button>
          <button
            type="button"
            className="btn header-nav-item__icon-btn"
            onClick={() => onMove(1)}
            disabled={index === siblingCount - 1}
            aria-label="Move item down"
            title="Move down"
          >
            <DownIcon />
          </button>
          {canNestMore && (
            <button type="button" className="btn" onClick={onAddChild}>
              Add Child
            </button>
          )}
          <button
            type="button"
            className="btn header-nav-item__icon-btn"
            onClick={onDelete}
            disabled={!canDelete}
            aria-label="Remove item"
            title="Remove item"
          >
            <DeleteIcon />
          </button>
        </div>
      </div>

      {item.childrenSource === 'services' && (
        <label className="header-nav-item__inline-field">
          Services Menu Style
          <select
            value={item.menuStyle}
            onChange={(event) => onChange({ ...item, menuStyle: event.target.value === 'mega' ? 'mega' : 'dropdown' })}
          >
            <option value="mega">Mega (group by parent)</option>
            <option value="dropdown">Dropdown (flat)</option>
          </select>
        </label>
      )}

      {item.childrenSource === 'service_groups' && (
        <label className="header-nav-item__inline-field header-nav-item__inline-field--wide">
          Parent Service Groups (columns)
          <select
            multiple
            size={Math.min(Math.max(parentServiceOptions.length, 4), 10)}
            value={item.sourceServiceIds ?? []}
            onChange={(event) =>
              onChange({
                ...item,
                menuStyle: 'mega',
                sourceServiceIds: Array.from(event.target.selectedOptions).map((option) => option.value),
              })
            }
          >
            {parentServiceOptions.map((service) => (
              <option key={service.id} value={service.id}>
                {service.title}
              </option>
            ))}
          </select>
          <small>Each selected parent becomes a mega-menu column with its child services.</small>
        </label>
      )}

      {item.childrenSource === 'service_children' && (
        <label className="header-nav-item__inline-field">
          Parent Service
          <select
            value={item.sourceServiceId ?? ''}
            onChange={(event) => onChange({ ...item, sourceServiceId: event.target.value || null })}
          >
            <option value="">Select parent service</option>
            {parentServiceOptions.map((service) => (
              <option key={service.id} value={service.id}>
                {service.title}
              </option>
            ))}
          </select>
          <small>URL auto-uses the selected parent service URL.</small>
        </label>
      )}

      {item.children.length > 0 && (
        <div className="header-nav-item__children">
          {item.children.map((child, childIndex) => (
            <NavItemEditor
              key={child.id}
              item={child}
              depth={depth + 1}
              index={childIndex}
              siblingCount={item.children.length}
              parentServiceOptions={parentServiceOptions}
              managedPagesBySlug={managedPagesBySlug}
              onChange={(nextChild) =>
                onChange({
                  ...item,
                  children: item.children.map((current) => (current.id === child.id ? nextChild : current)),
                })
              }
              onDelete={() =>
                onChange({
                  ...item,
                  children: item.children.filter((current) => current.id !== child.id),
                })
              }
              onMove={(direction) =>
                onChange({
                  ...item,
                  children: moveItem(item.children, childIndex, direction),
                })
              }
              onAddChild={() => undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
