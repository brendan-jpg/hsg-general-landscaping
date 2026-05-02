'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import DeleteIcon from '@/components/shared/icons/DeleteIcon';
import TemplateListSelect from '@/components/backend/TemplateListSelect';
import {
  deleteServicesBulk,
  reorderServicesAction,
  setPrimaryServiceAction,
  updateServiceTemplateKeyAction,
} from '@/lib/actions';
import { toTemplatePageContent } from '@/lib/sections/templatePages';
import { SERVICE_TEMPLATE_OPTIONS } from '@/lib/sections/templateOptions';
import type { Tables } from '@/lib/types/database';

type Service = Pick<
  Tables<'services'>,
  'id' | 'title' | 'slug' | 'parent_service_id' | 'sort_order' | 'is_primary' | 'content'
>;

type EditableService = Service & {
  sort_path: string;
};

interface ServicesAdminListProps {
  services: Service[];
  bulkPortalTargetId?: string;
  headerAction?: React.ReactNode;
}

function sanitizeSortPathInput(value: string) {
  return value.replace(/[^0-9.]/g, '').replace(/\.{2,}/g, '.').replace(/^\./, '');
}

function parseSortPath(value: string) {
  const normalized = sanitizeSortPathInput(value).trim().replace(/\.$/, '');
  if (!normalized) return [];
  return normalized
    .split('.')
    .map((segment) => Number(segment))
    .filter((segment) => Number.isFinite(segment) && segment >= 0)
    .map((segment) => Math.trunc(segment));
}

function compareSortPaths(a: string, b: string) {
  const aParts = parseSortPath(a);
  const bParts = parseSortPath(b);
  const maxLength = Math.max(aParts.length, bParts.length);
  for (let index = 0; index < maxLength; index += 1) {
    const aPart = aParts[index] ?? -1;
    const bPart = bParts[index] ?? -1;
    if (aPart !== bPart) return aPart - bPart;
  }
  return a.localeCompare(b);
}

function buildEditableServices(services: Service[]) {
  const serviceById = new Map(services.map((service) => [service.id, service]));
  const childServicesByParentId = new Map<string, Service[]>();
  const topLevelServices: Service[] = [];

  for (const service of services) {
    if (!service.parent_service_id) {
      topLevelServices.push(service);
      continue;
    }
    if (!serviceById.has(service.parent_service_id)) continue;

    const siblings = childServicesByParentId.get(service.parent_service_id) ?? [];
    siblings.push(service);
    childServicesByParentId.set(service.parent_service_id, siblings);
  }

  const sortedTopLevelServices = [...topLevelServices].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.title.localeCompare(b.title);
  });

  return sortedTopLevelServices.flatMap((service) => {
    const children = [...(childServicesByParentId.get(service.id) ?? [])].sort((a, b) => {
      if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
      return a.title.localeCompare(b.title);
    });

    return [
      { ...service, sort_path: String(service.sort_order) },
      ...children.map((child) => ({
        ...child,
        sort_path: `${service.sort_order}.${child.sort_order}`,
      })),
    ] satisfies EditableService[];
  });
}

function normalizeServiceSortPaths(services: EditableService[], prioritizedServiceId?: string) {
  const servicesById = new Map(services.map((service) => [service.id, service] as const));
  const topLevelServices = services.filter((service) => !service.parent_service_id);

  const orderedTopLevel = [...topLevelServices].sort((a, b) => {
    const aOrder = parseSortPath(a.sort_path)[0] ?? Number.MAX_SAFE_INTEGER;
    const bOrder = parseSortPath(b.sort_path)[0] ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    if (a.id === prioritizedServiceId) return -1;
    if (b.id === prioritizedServiceId) return 1;
    return a.title.localeCompare(b.title);
  });

  const childServicesByParentId = new Map<string, EditableService[]>();
  for (const service of services) {
    if (!service.parent_service_id) continue;
    if (!servicesById.has(service.parent_service_id)) continue;
    const siblings = childServicesByParentId.get(service.parent_service_id) ?? [];
    siblings.push(service);
    childServicesByParentId.set(service.parent_service_id, siblings);
  }

  const normalized: EditableService[] = [];
  orderedTopLevel.forEach((service, index) => {
    const nextTopLevelOrder = index + 1;
    normalized.push({
      ...service,
      parent_service_id: null,
      sort_path: String(nextTopLevelOrder),
    });

    const children = [...(childServicesByParentId.get(service.id) ?? [])].sort((a, b) => {
      const aOrder = parseSortPath(a.sort_path)[1] ?? Number.MAX_SAFE_INTEGER;
      const bOrder = parseSortPath(b.sort_path)[1] ?? Number.MAX_SAFE_INTEGER;
      if (aOrder !== bOrder) return aOrder - bOrder;
      if (a.id === prioritizedServiceId) return -1;
      if (b.id === prioritizedServiceId) return 1;
      return a.title.localeCompare(b.title);
    });

    children.forEach((child, childIndex) => {
      normalized.push({
        ...child,
        parent_service_id: service.id,
        sort_path: `${nextTopLevelOrder}.${childIndex + 1}`,
      });
    });
  });

  return normalized;
}

function applyCommittedSortPath(services: EditableService[], serviceId: string, nextSortPath: string) {
  const movingService = services.find((service) => service.id === serviceId);
  if (!movingService) return services;

  const nextSegments = parseSortPath(nextSortPath);
  if (nextSegments.length === 0) return services;

  if (nextSegments.length <= 1) {
    const targetOrder = Math.max(1, nextSegments[0] ?? 1);
    const nextServices = services.map((service) =>
      service.id === serviceId
        ? { ...service, parent_service_id: null, sort_path: String(targetOrder) }
        : service,
    );
    return normalizeServiceSortPaths(nextServices, serviceId);
  }

  const currentTopLevel = normalizeServiceSortPaths(services).filter((service) => !service.parent_service_id);
  const targetParent = currentTopLevel.find((service) => (parseSortPath(service.sort_path)[0] ?? 0) === nextSegments[0]);
  if (!targetParent) {
    return services.map((service) =>
      service.id === serviceId ? { ...service, sort_path: nextSortPath } : service,
    );
  }

  const targetChildOrder = Math.max(1, nextSegments[1] ?? 1);
  const nextServices = services.map((service) =>
    service.id === serviceId
      ? {
          ...service,
          parent_service_id: targetParent.id,
          sort_path: `${nextSegments[0]}.${targetChildOrder}`,
        }
      : service,
  );

  return normalizeServiceSortPaths(nextServices, serviceId);
}

function buildHierarchy(services: EditableService[]) {
  const topLevelServices = [...services]
    .filter((service) => parseSortPath(service.sort_path).length <= 1)
    .sort((a, b) => {
      const byPath = compareSortPaths(a.sort_path, b.sort_path);
      if (byPath !== 0) return byPath;
      return a.title.localeCompare(b.title);
    });
  const topLevelByExactPath = new Map<string, EditableService>();
  for (const service of topLevelServices) {
    const exactPath = sanitizeSortPathInput(service.sort_path).replace(/\.$/, '') || '0';
    if (!topLevelByExactPath.has(exactPath)) {
      topLevelByExactPath.set(exactPath, service);
    }
  }

  const childServicesByParentId = new Map<string, EditableService[]>();
  const orphanChildServices: EditableService[] = [];

  for (const service of services) {
    const segments = parseSortPath(service.sort_path);
    if (segments.length <= 1) continue;
    if (segments.length > 2) {
      orphanChildServices.push(service);
      continue;
    }

    const parent = topLevelByExactPath.get(String(segments[0]));
    if (!parent) {
      orphanChildServices.push(service);
      continue;
    }

    const siblings = childServicesByParentId.get(parent.id) ?? [];
    siblings.push(service);
    childServicesByParentId.set(parent.id, siblings);
  }

  for (const [parentId, children] of childServicesByParentId.entries()) {
    childServicesByParentId.set(
      parentId,
      [...children].sort((a, b) => {
        const byPath = compareSortPaths(a.sort_path, b.sort_path);
        if (byPath !== 0) return byPath;
        return a.title.localeCompare(b.title);
      }),
    );
  }

  orphanChildServices.sort((a, b) => {
    const byPath = compareSortPaths(a.sort_path, b.sort_path);
    if (byPath !== 0) return byPath;
    return a.title.localeCompare(b.title);
  });

  return { topLevelServices, orphanChildServices, childServicesByParentId };
}

function buildReorderPayload(services: EditableService[]) {
  const duplicateTopLevelPath = new Set<string>();
  const topLevelServices = [...services]
    .filter((service) => parseSortPath(service.sort_path).length <= 1)
    .sort((a, b) => {
      const byPath = compareSortPaths(a.sort_path, b.sort_path);
      if (byPath !== 0) return byPath;
      return a.title.localeCompare(b.title);
    });

  const topLevelByPath = new Map<string, EditableService>();
  for (const service of topLevelServices) {
    const key = String(parseSortPath(service.sort_path)[0] ?? 0);
    if (topLevelByPath.has(key)) duplicateTopLevelPath.add(key);
    topLevelByPath.set(key, service);
  }

  if (duplicateTopLevelPath.size > 0) {
    throw new Error('Top-level sort values must be unique when using decimal nesting.');
  }

  const childServices = services.filter((service) => parseSortPath(service.sort_path).length > 1);
  for (const service of childServices) {
    const segments = parseSortPath(service.sort_path);
    if (segments.length !== 2) {
      throw new Error('Decimal nesting supports only one parent level, such as 2.1 or 3.2.');
    }
    if (!topLevelByPath.has(String(segments[0]))) {
      throw new Error(`No parent service uses sort value ${segments[0]} for "${service.title}".`);
    }
  }

  return services.map((service) => {
    const segments = parseSortPath(service.sort_path);
    if (segments.length <= 1) {
      return {
        id: service.id,
        parent_service_id: null,
        sort_order: segments[0] ?? 0,
      };
    }

    return {
      id: service.id,
      parent_service_id: topLevelByPath.get(String(segments[0]))?.id ?? null,
      sort_order: segments[1] ?? 0,
    };
  });
}

export default function ServicesAdminList({ services, bulkPortalTargetId, headerAction }: ServicesAdminListProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editableServices, setEditableServices] = useState<EditableService[]>(() => buildEditableServices(services));
  const [sortDrafts, setSortDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(buildEditableServices(services).map((service) => [service.id, service.sort_path])),
  );
  const [orderError, setOrderError] = useState<string | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isUpdatingPrimary, setIsUpdatingPrimary] = useState(false);
  const [isDeleting, startDeletingTransition] = useTransition();
  const [bulkPortalTarget, setBulkPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const nextEditableServices = buildEditableServices(services);
    setEditableServices(nextEditableServices);
    setSortDrafts(Object.fromEntries(nextEditableServices.map((service) => [service.id, service.sort_path])));
  }, [services]);

  const { childServicesByParentId, topLevelServices, orphanChildServices } = useMemo(
    () => buildHierarchy(editableServices),
    [editableServices],
  );
  const allRowIds = useMemo(() => editableServices.map((service) => service.id), [editableServices]);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = editableServices.length > 0 && selectedIds.length === editableServices.length;
  const isOrderDirty = useMemo(() => {
    const initialById = new Map(buildEditableServices(services).map((service) => [service.id, service.sort_path] as const));
    return editableServices.some((service) => initialById.get(service.id) !== service.sort_path);
  }, [editableServices, services]);

  useEffect(() => {
    const validIds = new Set(allRowIds);
    setSelectedIds((current) => current.filter((id) => validIds.has(id)));
  }, [allRowIds]);

  useEffect(() => {
    if (!bulkPortalTargetId) {
      setBulkPortalTarget(null);
      return;
    }
    setBulkPortalTarget(document.getElementById(bulkPortalTargetId));
  }, [bulkPortalTargetId]);

  function updateSortDraft(serviceId: string, nextValue: string) {
    const nextSortPath = sanitizeSortPathInput(nextValue);
    setSortDrafts((current) => ({ ...current, [serviceId]: nextSortPath }));
  }

  function commitSortOrder(serviceId: string) {
    const nextSortPath = sanitizeSortPathInput(sortDrafts[serviceId] ?? '');
    setEditableServices((current) => {
      const nextServices = applyCommittedSortPath(current, serviceId, nextSortPath);
      setSortDrafts(Object.fromEntries(nextServices.map((service) => [service.id, service.sort_path])));
      return nextServices;
    });
  }

  async function handlePrimaryChange(serviceId: string, checked: boolean) {
    const previousServices = editableServices;
    const nextServices = editableServices.map((service) => ({
      ...service,
      is_primary: checked ? service.id === serviceId : false,
      parent_service_id: checked && service.id === serviceId ? null : service.parent_service_id,
    }));

    setOrderError(null);
    setIsUpdatingPrimary(true);
    setEditableServices(nextServices);

    try {
      await setPrimaryServiceAction(serviceId, checked);
      router.refresh();
    } catch (error) {
      setEditableServices(previousServices);
      setOrderError(error instanceof Error ? error.message : 'Unable to update primary service');
    } finally {
      setIsUpdatingPrimary(false);
    }
  }

  const toggleRow = (id: string, checked: boolean) => {
    setSelectedIds((current) => (checked ? Array.from(new Set([...current, id])) : current.filter((value) => value !== id)));
  };

  async function persistOrder() {
    setOrderError(null);
    setIsSavingOrder(true);

    try {
      await reorderServicesAction(
        buildReorderPayload(editableServices),
      );
      router.refresh();
    } catch (error) {
      setEditableServices(buildEditableServices(services));
      setOrderError(error instanceof Error ? error.message : 'Unable to save service order');
    } finally {
      setIsSavingOrder(false);
    }
  }

  const bulkControls = (
    <div className="data-table__bulk-bar">
      <div className="data-table__bulk-action">
        {selectedIds.length > 0 && (
          <button
            type="button"
            className="media-picker__icon-btn media-picker__icon-btn--danger media-picker__icon-btn--flat"
            disabled={isDeleting || isSavingOrder || isUpdatingPrimary}
            title={isDeleting ? 'Deleting...' : `Delete selected (${selectedIds.length})`}
            aria-label={isDeleting ? 'Deleting selected services' : `Delete ${selectedIds.length} selected services`}
            onClick={() => {
              if (selectedIds.length === 0) return;
              const confirmed = window.confirm(`Delete ${selectedIds.length} services? This cannot be undone.`);
              if (!confirmed) return;

              startDeletingTransition(async () => {
                await deleteServicesBulk(selectedIds);
                setSelectedIds([]);
                router.refresh();
              });
            }}
          >
            <DeleteIcon />
          </button>
        )}
      </div>
      <span className="data-table__bulk-total">
        {selectedIds.length > 0 ? `${selectedIds.length} Selected` : `${editableServices.length} Total`}
      </span>
      <div className="service-admin-bulk-side">
        {(isSavingOrder || isUpdatingPrimary || orderError) && (
          <span className={`service-admin-save-state ${orderError ? 'service-admin-save-state--error' : ''}`}>
            {orderError ? orderError : isUpdatingPrimary ? 'Updating primary...' : 'Saving order...'}
          </span>
        )}
        {isOrderDirty && (
          <button
            type="button"
            className="btn"
            disabled={isSavingOrder || isUpdatingPrimary || isDeleting}
            onClick={() => void persistOrder()}
          >
            Save Sort Order
          </button>
        )}
      </div>
    </div>
  );

  if (editableServices.length === 0) {
    return (
      <div className="service-admin-empty">
        {headerAction ? <div className="service-admin-empty__action">{headerAction}</div> : null}
        <div className="data-table__surface">
          <div className="empty-state">
            <p>No services yet.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {bulkPortalTargetId && bulkPortalTarget ? createPortal(bulkControls, bulkPortalTarget) : bulkControls}
      <div className="data-table__surface">
        <div className="data-table__wrapper">
          <div className="service-admin-list__header">
            <label className="service-admin-select service-admin-select--header" aria-label="Select all services">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(event) => setSelectedIds(event.target.checked ? [...allRowIds] : [])}
                aria-label="Select all services"
              />
            </label>
            <div className="service-admin-list__header-labels">
              <span>Sort</span>
              <span>Service</span>
              <span>Template</span>
            </div>
            {headerAction && <div className="service-admin-list__header-action">{headerAction}</div>}
          </div>
          <div className="service-admin-list">
          {topLevelServices.map((service) => {
            const childServices = childServicesByParentId.get(service.id) ?? [];
            const parentSelected = selectedIdSet.has(service.id);

            return (
              <section
                key={service.id}
                className={`service-admin-group ${parentSelected ? 'service-admin-group--selected' : ''}`}
              >
                <div className="service-admin-group__parent-row">
                  <label className="service-admin-select" aria-label={`Select ${service.title}`}>
                    <input
                      type="checkbox"
                      checked={parentSelected}
                      onChange={(event) => toggleRow(service.id, event.target.checked)}
                    />
                  </label>
                  <div className="service-admin-row service-admin-row--parent">
                    <label className="service-admin-sort-field" aria-label={`Sort order for ${service.title}`}>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={sortDrafts[service.id] ?? service.sort_path}
                        onChange={(event) => updateSortDraft(service.id, event.target.value)}
                        onBlur={() => commitSortOrder(service.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            commitSortOrder(service.id);
                            (event.currentTarget as HTMLInputElement).blur();
                          }
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            setSortDrafts((current) => ({ ...current, [service.id]: service.sort_path }));
                            (event.currentTarget as HTMLInputElement).blur();
                          }
                        }}
                      />
                    </label>
                    <Link href={`/dashboard/services/${service.id}`} className="service-admin-group__parent">
                      <div className="service-admin-group__meta">
                        <span className="service-admin-group__title">{service.title}</span>
                      </div>
                    </Link>
                    <div className="service-admin-template-cell">
                      <TemplateListSelect
                        ariaLabel={`Template for ${service.title}`}
                        initialValue={toTemplatePageContent(service.content)?.templateKey ?? SERVICE_TEMPLATE_OPTIONS[0]?.key ?? 'service-content-v1'}
                        options={SERVICE_TEMPLATE_OPTIONS}
                        onChangeAction={(nextValue) => updateServiceTemplateKeyAction(service.id, nextValue)}
                      />
                    </div>
                    <label className="service-admin-primary-toggle">
                      <input
                        type="checkbox"
                        checked={service.is_primary}
                        disabled={isSavingOrder || isUpdatingPrimary}
                        onChange={(event) => void handlePrimaryChange(service.id, event.target.checked)}
                      />
                      <span>Primary</span>
                    </label>
                  </div>
                </div>

                <div className="service-admin-group__children">
                  {childServices.map((child) => {
                    const childSelected = selectedIdSet.has(child.id);

                    return (
                      <div
                        key={child.id}
                        className={`service-admin-child-row ${childSelected ? 'service-admin-child-row--selected' : ''}`}
                      >
                        <label className="service-admin-select" aria-label={`Select ${child.title}`}>
                          <input
                            type="checkbox"
                            checked={childSelected}
                            onChange={(event) => toggleRow(child.id, event.target.checked)}
                          />
                        </label>
                        <div className="service-admin-row service-admin-row--child">
                          <label className="service-admin-sort-field service-admin-sort-field--child" aria-label={`Sort order for ${child.title}`}>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={sortDrafts[child.id] ?? child.sort_path}
                              onChange={(event) => updateSortDraft(child.id, event.target.value)}
                              onBlur={() => commitSortOrder(child.id)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  commitSortOrder(child.id);
                                  (event.currentTarget as HTMLInputElement).blur();
                                }
                                if (event.key === 'Escape') {
                                  event.preventDefault();
                                  setSortDrafts((current) => ({ ...current, [child.id]: child.sort_path }));
                                  (event.currentTarget as HTMLInputElement).blur();
                                }
                              }}
                            />
                          </label>
                          <Link href={`/dashboard/services/${child.id}`} className="service-admin-child">
                            <span className="service-admin-child__branch" aria-hidden="true">
                              L
                            </span>
                            <span className="service-admin-child__meta">
                              <span className="service-admin-child__title">{child.title}</span>
                            </span>
                          </Link>
                          <div className="service-admin-template-cell service-admin-template-cell--child">
                            <TemplateListSelect
                              ariaLabel={`Template for ${child.title}`}
                              initialValue={toTemplatePageContent(child.content)?.templateKey ?? SERVICE_TEMPLATE_OPTIONS[0]?.key ?? 'service-content-v1'}
                              options={SERVICE_TEMPLATE_OPTIONS}
                              onChangeAction={(nextValue) => updateServiceTemplateKeyAction(child.id, nextValue)}
                            />
                          </div>
                          <div className="service-admin-primary-spacer" aria-hidden="true" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}

          {orphanChildServices.length > 0 && (
            <section className="service-admin-group service-admin-group--orphan">
              <div className="service-admin-group__parent">
                <div className="service-admin-group__meta">
                  <h2 className="service-admin-group__title-text">Orphaned Child Services</h2>
                  <p className="service-admin-group__hint">
                    These reference a parent service that no longer exists.
                  </p>
                </div>
              </div>
              <div className="service-admin-group__children">
                {orphanChildServices.map((child) => {
                  const childSelected = selectedIdSet.has(child.id);
                  return (
                    <div
                      key={child.id}
                      className={`service-admin-child-row ${childSelected ? 'service-admin-child-row--selected' : ''}`}
                    >
                      <label className="service-admin-select" aria-label={`Select ${child.title}`}>
                        <input
                          type="checkbox"
                          checked={childSelected}
                          onChange={(event) => toggleRow(child.id, event.target.checked)}
                        />
                      </label>
                      <div className="service-admin-row service-admin-row--child">
                        <label className="service-admin-sort-field service-admin-sort-field--child" aria-label={`Sort order for ${child.title}`}>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={sortDrafts[child.id] ?? child.sort_path}
                            onChange={(event) => updateSortDraft(child.id, event.target.value)}
                            onBlur={() => commitSortOrder(child.id)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                commitSortOrder(child.id);
                                (event.currentTarget as HTMLInputElement).blur();
                              }
                              if (event.key === 'Escape') {
                                event.preventDefault();
                                setSortDrafts((current) => ({ ...current, [child.id]: child.sort_path }));
                                (event.currentTarget as HTMLInputElement).blur();
                              }
                            }}
                          />
                        </label>
                        <Link href={`/dashboard/services/${child.id}`} className="service-admin-child">
                          <span className="service-admin-child__branch" aria-hidden="true">
                            !
                          </span>
                          <span className="service-admin-child__meta">
                            <span className="service-admin-child__title">{child.title}</span>
                          </span>
                        </Link>
                        <div className="service-admin-template-cell service-admin-template-cell--child">
                          <TemplateListSelect
                            ariaLabel={`Template for ${child.title}`}
                            initialValue={toTemplatePageContent(child.content)?.templateKey ?? SERVICE_TEMPLATE_OPTIONS[0]?.key ?? 'service-content-v1'}
                            options={SERVICE_TEMPLATE_OPTIONS}
                            onChangeAction={(nextValue) => updateServiceTemplateKeyAction(child.id, nextValue)}
                          />
                        </div>
                        <div className="service-admin-primary-spacer" aria-hidden="true" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
          </div>
        </div>
      </div>
    </>
  );
}
