'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import DeleteIcon from '@/components/shared/icons/DeleteIcon';

interface DataTableBulkDeleteConfig {
  rowIds: Array<string | null>;
  onDeleteSelected: (ids: string[]) => Promise<unknown>;
  itemLabel?: string;
}

interface DataTableProps {
  columns: string[];
  rows: Record<string, React.ReactNode>[];
  emptyMessage?: string;
  rowHrefs?: string[];
  headerAction?: React.ReactNode;
  bulkDelete?: DataTableBulkDeleteConfig;
  bulkDeletePortalTargetId?: string;
  bulkDeleteSelectLabel?: string;
  selectableRowIds?: Array<string | null>;
  selectablePortalTargetId?: string;
  selectableSelectLabel?: string;
  selectableItemLabel?: string;
}

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest('a, button, input, select, textarea, label'));
}

export default function DataTable({
  columns,
  rows,
  emptyMessage,
  rowHrefs,
  headerAction,
  bulkDelete,
  bulkDeletePortalTargetId,
  bulkDeleteSelectLabel,
  selectableRowIds,
  selectablePortalTargetId,
  selectableSelectLabel,
  selectableItemLabel,
}: DataTableProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, startDeletingTransition] = useTransition();
  const [bulkPortalTarget, setBulkPortalTarget] = useState<HTMLElement | null>(null);

  const selectionRowIds =
    bulkDelete?.rowIds && bulkDelete.rowIds.length === rows.length
      ? bulkDelete.rowIds
      : selectableRowIds && selectableRowIds.length === rows.length
        ? selectableRowIds
        : null;

  const canSelectRows = Array.isArray(selectionRowIds) && selectionRowIds.length === rows.length;
  const canBulkDelete = Boolean(bulkDelete) && canSelectRows && bulkDelete!.rowIds.length === rows.length;

  const allRowIds = useMemo(
    () =>
      canSelectRows && selectionRowIds
        ? selectionRowIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        : [],
    [canSelectRows, selectionRowIds],
  );
  const selectedCount = selectedIds.length;
  const allSelected = canSelectRows && allRowIds.length > 0 && selectedCount === allRowIds.length;
  const itemLabel = bulkDelete?.itemLabel ?? selectableItemLabel ?? 'items';
  const selectLabel = bulkDeleteSelectLabel ?? selectableSelectLabel ?? 'Select all';
  const selectionPortalTargetId = bulkDeletePortalTargetId ?? selectablePortalTargetId;

  useEffect(() => {
    if (!canSelectRows) {
      setSelectedIds([]);
      return;
    }

    const validIds = new Set(allRowIds);
    setSelectedIds((current) => current.filter((id) => validIds.has(id)));
  }, [canSelectRows, allRowIds]);

  useEffect(() => {
    if (!selectionPortalTargetId) {
      setBulkPortalTarget(null);
      return;
    }

    setBulkPortalTarget(document.getElementById(selectionPortalTargetId));
  }, [selectionPortalTargetId]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const bulkControls = canSelectRows ? (
    <div className="data-table__bulk-bar">
      <div className="data-table__bulk-action">
        {canBulkDelete && selectedCount > 0 && (
          <button
            type="button"
            className="media-picker__icon-btn media-picker__icon-btn--danger media-picker__icon-btn--flat"
            disabled={isDeleting}
            title={isDeleting ? 'Deleting...' : `Delete selected (${selectedCount})`}
            aria-label={isDeleting ? 'Deleting selected items' : `Delete ${selectedCount} selected ${itemLabel}`}
            onClick={() => {
              if (!bulkDelete || selectedCount === 0) return;
              const confirmed = window.confirm(
                `Delete ${selectedCount} ${itemLabel}? This cannot be undone.`
              );
              if (!confirmed) return;

              startDeletingTransition(async () => {
                await bulkDelete.onDeleteSelected(selectedIds);
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
        {selectedCount > 0 ? `${selectedCount} Selected` : selectLabel}
      </span>
    </div>
  ) : null;

  if (rows.length === 0) {
    return (
      <div className="data-table__stack">
        {headerAction && <div className="data-table__header-bar">{headerAction}</div>}
        <div className="data-table__surface">
          <div className="data-table__empty">
            <p>{emptyMessage || 'No data'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="data-table__stack">
      {bulkControls && !selectionPortalTargetId && bulkControls}
      {bulkControls && selectionPortalTargetId && bulkPortalTarget && createPortal(bulkControls, bulkPortalTarget)}
      <div className="data-table__surface">
        <div className="data-table__wrapper">
          <table className="data-table">
            <thead className="data-table__head">
              <tr>
                {canSelectRows && (
                  <th className="data-table__th data-table__th--checkbox" aria-label="Select all rows">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(event) => {
                        setSelectedIds(event.target.checked ? [...allRowIds] : []);
                      }}
                      aria-label={`Select all ${itemLabel}`}
                    />
                  </th>
                )}
                {columns.map(col => (
                  <th key={col} className="data-table__th">{col}</th>
                ))}
                {headerAction && (
                  <th className="data-table__th data-table__th--action" aria-label="Table actions">
                    <div className="data-table__th-action-wrap">{headerAction}</div>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="data-table__body">
              {rows.map((row, i) => {
                const rowId = canBulkDelete ? bulkDelete?.rowIds[i] ?? null : null;
                const isSelectable = typeof rowId === 'string' && rowId.trim().length > 0;
                const isSelected = isSelectable ? selectedIdSet.has(rowId) : false;

                return (
                  <tr
                    key={i}
                    className={`data-table__row ${rowHrefs?.[i] ? 'data-table__row--clickable' : ''} ${isSelected ? 'data-table__row--selected' : ''}`}
                    onClick={(event) => {
                      if (isInteractiveTarget(event.target)) return;
                      const href = rowHrefs?.[i];
                      if (href) router.push(href);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      if (isInteractiveTarget(event.target)) return;
                      const href = rowHrefs?.[i];
                      if (!href) return;
                      event.preventDefault();
                      router.push(href);
                    }}
                    tabIndex={rowHrefs?.[i] ? 0 : undefined}
                  >
                    {canSelectRows && (
                      <td
                        className="data-table__td data-table__td--checkbox"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!isSelectable}
                          onChange={(event) => {
                            if (!isSelectable) return;
                            setSelectedIds((current) =>
                              event.target.checked
                                ? [...current, rowId]
                                : current.filter((id) => id !== rowId)
                            );
                          }}
                          aria-label={isSelectable ? `Select row ${i + 1}` : `Row ${i + 1} cannot be selected`}
                        />
                      </td>
                    )}
                    {columns.map(col => (
                      <td key={col} className="data-table__td">{row[col]}</td>
                    ))}
                    {headerAction && <td className="data-table__td data-table__td--action" aria-hidden="true" />}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
