'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import DataTable from '@/components/backend/DataTable';
import {
  createQuickBooksItemAction,
  deactivateQuickBooksItemAction,
  updateQuickBooksItemAction,
} from '@/lib/actions';
import type { QuickBooksSelectableItem } from '@/lib/integrations/quickbooks';

interface QuickBooksItemsManagerProps {
  items: QuickBooksSelectableItem[];
}

type EditableType = 'Service' | 'NonInventory';

const ITEM_TYPE_OPTIONS: EditableType[] = ['Service', 'NonInventory'];

function formatCurrency(value: number | null) {
  if (value === null) return '-';
  return `$${value.toFixed(2)}`;
}

export default function QuickBooksItemsManager({ items }: QuickBooksItemsManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftUnitPrice, setDraftUnitPrice] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<EditableType>('Service');
  const [newDescription, setNewDescription] = useState('');
  const [newUnitPrice, setNewUnitPrice] = useState('');

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.name.localeCompare(b.name)),
    [items],
  );

  function startEditing(item: QuickBooksSelectableItem) {
    setEditingId(item.id);
    setDraftName(item.name);
    setDraftDescription(item.description ?? '');
    setDraftUnitPrice(item.unitPrice === null ? '' : String(item.unitPrice));
    setError(null);
  }

  function stopEditing() {
    setEditingId(null);
    setDraftName('');
    setDraftDescription('');
    setDraftUnitPrice('');
  }

  async function handleCreate() {
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set('name', newName);
        formData.set('type', newType);
        formData.set('description', newDescription);
        formData.set('unit_price', newUnitPrice);
        await createQuickBooksItemAction(formData);
        setNewName('');
        setNewType('Service');
        setNewDescription('');
        setNewUnitPrice('');
        router.refresh();
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : 'Unable to create QuickBooks item');
      }
    });
  }

  async function handleSave(itemId: string) {
    setError(null);
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set('item_id', itemId);
        formData.set('name', draftName);
        formData.set('description', draftDescription);
        formData.set('unit_price', draftUnitPrice);
        await updateQuickBooksItemAction(formData);
        stopEditing();
        router.refresh();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'Unable to update QuickBooks item');
      }
    });
  }

  async function handleDeactivate(itemId: string) {
    if (!window.confirm('Deactivate this QuickBooks item? It will no longer be selectable on new estimates and invoices.')) {
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        await deactivateQuickBooksItemAction(itemId);
        if (editingId === itemId) stopEditing();
        router.refresh();
      } catch (deactivateError) {
        setError(deactivateError instanceof Error ? deactivateError.message : 'Unable to deactivate QuickBooks item');
      }
    });
  }

  return (
    <div className="settings__section settings-card settings-panel quickbooks-items-manager">
      {error ? <p className="form-error">{error}</p> : null}

      <div className="settings-business-form__section">
        <div className="settings-business-form__section-head">
          <span className="settings-panel__eyebrow">New Item</span>
          <p className="settings-panel__lede">New items are created directly in QuickBooks.</p>
        </div>
        <div className="data-table__wrapper">
          <table className="data-table">
            <thead className="data-table__head">
              <tr>
                <th className="data-table__th">Name</th>
                <th className="data-table__th">Type</th>
                <th className="data-table__th">Description</th>
                <th className="data-table__th">Default Price</th>
                <th className="data-table__th data-table__th--action">Action</th>
              </tr>
            </thead>
            <tbody className="data-table__body">
              <tr className="data-table__row">
                <td className="data-table__td">
                  <label className="quickbooks-items-manager__table-field">
                    <span className="sr-only">Name</span>
                    <input
                      value={newName}
                      onChange={(event) => setNewName(event.target.value)}
                      placeholder="Spring cleanup"
                    />
                  </label>
                </td>
                <td className="data-table__td">
                  <label className="quickbooks-items-manager__table-field">
                    <span className="sr-only">Type</span>
                    <select value={newType} onChange={(event) => setNewType(event.target.value as EditableType)}>
                      {ITEM_TYPE_OPTIONS.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                </td>
                <td className="data-table__td">
                  <label className="quickbooks-items-manager__table-field">
                    <span className="sr-only">Description</span>
                    <input
                      value={newDescription}
                      onChange={(event) => setNewDescription(event.target.value)}
                      placeholder="Optional default line description"
                    />
                  </label>
                </td>
                <td className="data-table__td">
                  <label className="quickbooks-items-manager__table-field">
                    <span className="sr-only">Default Price</span>
                    <input
                      type="number"
                      step="0.01"
                      value={newUnitPrice}
                      onChange={(event) => setNewUnitPrice(event.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                </td>
                <td className="data-table__td data-table__td--action">
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={isPending}
                    onClick={() => void handleCreate()}
                  >
                    {isPending ? 'Saving...' : '+ Add Item'}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="settings-business-form__section">
        <div className="settings-business-form__section-head">
          <span className="settings-panel__eyebrow">Current Items</span>
          <p className="settings-panel__lede">{sortedItems.length} active QuickBooks items.</p>
        </div>

        {sortedItems.length === 0 ? (
          <div className="data-table__empty">
            <p>No QuickBooks items yet.</p>
          </div>
        ) : (
          <DataTable
            columns={['Name', 'Type', 'Description', 'Default Price', 'Actions']}
            rows={sortedItems.map((item) => {
              const isEditing = editingId === item.id;

              return {
                Name: isEditing ? (
                  <div className="quickbooks-items-manager__cell-field">
                    <input value={draftName} onChange={(event) => setDraftName(event.target.value)} />
                  </div>
                ) : (
                  item.name
                ),
                Type: item.type || '-',
                Description: isEditing ? (
                  <div className="quickbooks-items-manager__cell-field">
                    <input
                      value={draftDescription}
                      onChange={(event) => setDraftDescription(event.target.value)}
                      placeholder="Optional description"
                    />
                  </div>
                ) : (
                  item.description || '-'
                ),
                'Default Price': isEditing ? (
                  <div className="quickbooks-items-manager__cell-field">
                    <input
                      type="number"
                      step="0.01"
                      value={draftUnitPrice}
                      onChange={(event) => setDraftUnitPrice(event.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                ) : (
                  formatCurrency(item.unitPrice)
                ),
                Actions: (
                  <div className="settings-panel__action-row">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          className="btn btn--secondary"
                          disabled={isPending}
                          onClick={() => void handleSave(item.id)}
                        >
                          {isPending ? 'Saving...' : 'Save'}
                        </button>
                        <button type="button" className="btn" disabled={isPending} onClick={stopEditing}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn--secondary"
                        disabled={isPending}
                        onClick={() => startEditing(item)}
                      >
                        Edit
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn"
                      disabled={isPending}
                      onClick={() => void handleDeactivate(item.id)}
                    >
                      Delete
                    </button>
                  </div>
                ),
              };
            })}
            emptyMessage="No QuickBooks items yet."
          />
        )}
      </div>
    </div>
  );
}
