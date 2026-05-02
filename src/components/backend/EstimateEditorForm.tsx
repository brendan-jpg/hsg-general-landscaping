'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useDirtyState from '@/components/backend/useDirtyState';
import {
  createInvoiceFromEstimateAction,
  deleteEstimate,
  saveEstimate,
  sendEstimate,
  syncQuickBooksEstimateAction,
  updateEstimateStatusAction,
} from '@/lib/actions';
import type { LineItem } from '@/lib/types';
import type { Tables } from '@/lib/types/database';

type Estimate = Tables<'estimates'>;

interface EstimateEditorFormProps {
  estimate: Estimate | null;
  contacts: Array<{ id: string; first_name: string | null; last_name: string | null }>;
  initialContactId?: string;
  quickBooksItems: Array<{ id: string; name: string; type: string; unitPrice: number | null }>;
  defaultTaxRate?: number | null;
}

function parseLineItems(value: unknown): LineItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = item as Partial<LineItem>;
      const qty = Number(row.qty ?? 0);
      const unit = Number(row.unit_price ?? 0);
      return {
        description: String(row.description ?? '').trim(),
        qty: Number.isFinite(qty) ? qty : 0,
        unit_price: Number.isFinite(unit) ? unit : 0,
        total: Number.isFinite(qty * unit) ? qty * unit : 0,
        qbo_item_id: typeof row.qbo_item_id === 'string' ? row.qbo_item_id : null,
        qbo_item_name: typeof row.qbo_item_name === 'string' ? row.qbo_item_name : null,
      };
    })
    .filter((item) => item.description.length > 0);
}

function contactName(contact: { first_name: string | null; last_name: string | null }) {
  return [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || 'Unnamed Contact';
}

export default function EstimateEditorForm({
  estimate,
  contacts,
  initialContactId,
  quickBooksItems,
  defaultTaxRate,
}: EstimateEditorFormProps) {
  const router = useRouter();
  const [estimateNumber, setEstimateNumber] = useState(estimate?.estimate_number ?? '');
  const [contactId, setContactId] = useState(estimate?.contact_id ?? initialContactId ?? '');
  const [status, setStatus] = useState<Estimate['status']>(estimate?.status ?? 'draft');
  const [validUntil, setValidUntil] = useState(estimate?.valid_until ?? '');
  const [taxRate, setTaxRate] = useState(String(estimate?.tax_rate ?? defaultTaxRate ?? 0));
  const [notes, setNotes] = useState(estimate?.notes ?? '');
  const [lineItems, setLineItems] = useState<LineItem[]>(() => {
    const parsed = parseLineItems(estimate?.line_items);
    return parsed.length > 0 ? parsed : [{ description: '', qty: 1, unit_price: 0, total: 0, qbo_item_id: null, qbo_item_name: null }];
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveMode, setSaveMode] = useState<'draft' | 'send'>('draft');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);
  const [isQuickBooksSyncing, setIsQuickBooksSyncing] = useState(false);
  const [quickBooksMessage, setQuickBooksMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEditingDetails, setIsEditingDetails] = useState(false);

  const subtotal = useMemo(() => lineItems.reduce((sum, item) => sum + item.qty * item.unit_price, 0), [lineItems]);
  const tax = useMemo(() => subtotal * ((Number(taxRate) || 0) / 100), [subtotal, taxRate]);
  const total = subtotal + tax;
  const selectedContact = useMemo(() => contacts.find((contact) => contact.id === contactId) ?? null, [contacts, contactId]);
  const isReviewMode = Boolean(estimate?.id && (status === 'sent' || status === 'viewed') && !isEditingDetails);
  const isDirty = useDirtyState({
    estimateNumber,
    contactId,
    status,
    validUntil,
    taxRate,
    notes,
    lineItems,
  });

  function buildEstimateFormData(nextStatus?: Estimate['status']) {
    const formData = new FormData();
    if (estimate?.id) formData.set('id', estimate.id);
    formData.set('estimate_number', estimateNumber);
    formData.set('contact_id', contactId);
    formData.set('status', nextStatus ?? status);
    formData.set('valid_until', validUntil);
    formData.set('tax_rate', taxRate);
    formData.set('notes', notes);
    formData.set('line_items', JSON.stringify(lineItems));
    return formData;
  }

  function updateLineItem(index: number, patch: Partial<LineItem>) {
    setLineItems((current) =>
      current.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, ...patch };
        return { ...next, total: next.qty * next.unit_price };
      })
    );
  }

  function updateLineItemQuickBooksItem(index: number, nextItemId: string) {
    const selectedItem = quickBooksItems.find((item) => item.id === nextItemId) ?? null;
    setLineItems((current) =>
      current.map((item, i) => {
        if (i !== index) return item;
        const shouldReplaceDescription = !item.description.trim() || item.description.trim() === (item.qbo_item_name ?? '').trim();
        return {
          ...item,
          description: selectedItem && shouldReplaceDescription ? selectedItem.name : item.description,
          unit_price: selectedItem?.unitPrice ?? item.unit_price,
          qbo_item_id: selectedItem?.id ?? null,
          qbo_item_name: selectedItem?.name ?? null,
          total: item.qty * (selectedItem?.unitPrice ?? item.unit_price),
        };
      })
    );
  }

  function handlePriceFieldFocus(event: React.FocusEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    requestAnimationFrame(() => {
      input.select();
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const nativeSubmit = event.nativeEvent as SubmitEvent;
      const submitter = nativeSubmit.submitter as HTMLButtonElement | null;
      const submitIntent = submitter?.value === 'send' ? 'send' : 'draft';
      setSaveMode(submitIntent);

      const formData = buildEstimateFormData(submitIntent === 'draft' ? 'draft' : status);

      const result = await saveEstimate(formData);
      if (submitIntent === 'send') {
        await sendEstimate(result.id);
      }
      router.push('/dashboard/estimates');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save estimate');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleQuickStatusChange(nextStatus: Estimate['status']) {
    if (!estimate?.id) return;
    setError(null);
    setQuickBooksMessage(null);
    setIsSaving(true);
    try {
      await updateEstimateStatusAction(estimate.id, nextStatus);
      setStatus(nextStatus);
      router.refresh();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Unable to update estimate status');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!estimate?.id) return;
    if (!window.confirm('Delete this estimate? This cannot be undone.')) return;

    setError(null);
    setIsDeleting(true);
    try {
      await deleteEstimate(estimate.id);
      router.push('/dashboard/estimates');
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete estimate');
      setIsDeleting(false);
    }
  }

  async function handleQuickBooksSync() {
    if (!estimate?.id) return;
    setError(null);
    setQuickBooksMessage(null);
    setIsQuickBooksSyncing(true);
    try {
      const result = await syncQuickBooksEstimateAction(estimate.id);
      setQuickBooksMessage(
        result.created
          ? `QuickBooks estimate created (${result.qboEstimateId})`
          : `QuickBooks estimate updated (${result.qboEstimateId})`
      );
      router.refresh();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Unable to sync estimate to QuickBooks');
    } finally {
      setIsQuickBooksSyncing(false);
    }
  }

  async function handleCreateInvoiceFromEstimate() {
    if (!estimate?.id) return;
    setError(null);
    setQuickBooksMessage(null);
    setIsCreatingInvoice(true);
    try {
      const result = await createInvoiceFromEstimateAction(estimate.id);
      router.push(`/dashboard/invoices/${result.id}`);
      router.refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create invoice from estimate');
      setIsCreatingInvoice(false);
    }
  }

  const quickStatusActions: Array<{ label: string; value: Estimate['status']; primary?: boolean }> = [];
  if (estimate?.id && (status === 'sent' || status === 'viewed')) {
    if (status === 'sent') {
      quickStatusActions.push({ label: 'Mark Viewed', value: 'viewed' });
    }
    quickStatusActions.push({ label: 'Approve', value: 'approved', primary: true });
    quickStatusActions.push({ label: 'Decline', value: 'declined' });
    quickStatusActions.push({ label: 'Mark Expired', value: 'expired' });
    if (status === 'viewed') {
      quickStatusActions.push({ label: 'Move Back to Sent', value: 'sent' });
    }
  }

  return (
    <form className="editor" onSubmit={handleSubmit}>
      <div className="editor__main">
        {isReviewMode ? (
          <div className="estimate-review">
            <div className="estimate-review__header">
              <div>
                <h2 className="estimate-review__title">{estimateNumber || estimate?.estimate_number || 'Estimate'}</h2>
                <p className="estimate-review__meta">
                  {selectedContact ? contactName(selectedContact) : 'No contact selected'}
                  {validUntil ? ` • Valid until ${validUntil}` : ''}
                </p>
              </div>
              <div className="estimate-review__status">{status}</div>
            </div>

            <div className="estimate-review__totals">
              <div><span>Subtotal</span><strong>${subtotal.toFixed(2)}</strong></div>
              <div><span>Tax</span><strong>${tax.toFixed(2)}</strong></div>
              <div><span>Total</span><strong>${total.toFixed(2)}</strong></div>
            </div>

            <div className="estimate-review__items">
              <div className="estimate-review__items-head">
                <span>Item</span>
                <span>Qty</span>
                <span>Unit</span>
                <span>Total</span>
              </div>
              {lineItems.map((item, index) => (
                <div key={index} className="estimate-review__items-row">
                  <span>{item.description || 'Untitled item'}</span>
                  <span>{item.qty}</span>
                  <span>${item.unit_price.toFixed(2)}</span>
                  <strong>${(item.qty * item.unit_price).toFixed(2)}</strong>
                </div>
              ))}
            </div>

            {notes && (
              <div className="estimate-review__notes">
                <h3>Notes</h3>
                <p>{notes}</p>
              </div>
            )}
          </div>
        ) : (
          <>
            <input
              className="editor__title-input"
              type="text"
              placeholder="Estimate number (auto if blank)"
              value={estimateNumber}
              onChange={(event) => setEstimateNumber(event.target.value)}
            />
            <div className="editor__field-group">
              <div className="line-items-editor">
                <div className="line-items-editor__head" aria-hidden="true">
                  <span className="line-items-editor__head-item">Item</span>
                  <span className="line-items-editor__head-description">Description</span>
                  <span className="line-items-editor__head-qty">Qty</span>
                  <span className="line-items-editor__head-price">Price</span>
                  <span className="line-items-editor__head-action" />
                </div>
                {lineItems.map((item, index) => (
                  <div key={index} className="line-items-editor__row">
                    <select
                      className="line-items-editor__item-select"
                      aria-label={`QuickBooks item for line item ${index + 1}`}
                      value={item.qbo_item_id ?? ''}
                      onChange={(event) => updateLineItemQuickBooksItem(index, event.target.value)}
                      disabled={quickBooksItems.length === 0}
                    >
                      <option value="">
                        {quickBooksItems.length > 0 ? 'Select item' : 'No QuickBooks items'}
                      </option>
                      {quickBooksItems.map((quickBooksItem) => (
                        <option key={quickBooksItem.id} value={quickBooksItem.id}>
                          {quickBooksItem.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Description"
                      value={item.description}
                      onChange={(event) => updateLineItem(index, { description: event.target.value })}
                    />
                    <input
                      type="number"
                      aria-label={`Quantity for line item ${index + 1}`}
                      value={item.qty}
                      onChange={(event) => updateLineItem(index, { qty: Number(event.target.value) })}
                    />
                    <input
                      type="number"
                      aria-label={`Price for line item ${index + 1}`}
                      value={item.unit_price}
                      onFocus={handlePriceFieldFocus}
                      onChange={(event) => updateLineItem(index, { unit_price: Number(event.target.value) })}
                    />
                    <button
                      className="btn"
                      type="button"
                      onClick={() => setLineItems((current) => current.filter((_, i) => i !== index))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  className="btn"
                  type="button"
                  onClick={() =>
                    setLineItems((current) => [
                      ...current,
                      { description: '', qty: 1, unit_price: 0, total: 0, qbo_item_id: null, qbo_item_name: null },
                    ])
                  }
                >
                  Add Item
                </button>
              </div>
            </div>
            <div className="editor__field-group">
              <label>Notes</label>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={8} />
            </div>
          </>
        )}
      </div>
      <aside className="editor__sidebar">
        {isReviewMode && (
          <div className="editor__field-group">
            <label>Review Actions</label>
            <div className="estimate-review__actions">
              {quickStatusActions.map((action) => (
                <button
                  key={action.value}
                  className={`btn${action.primary ? ' btn--primary' : ''}`}
                  type="button"
                  onClick={() => handleQuickStatusChange(action.value)}
                  disabled={isSaving || isDeleting || isCreatingInvoice || isQuickBooksSyncing}
                >
                  {isSaving && status !== action.value ? 'Updating...' : action.label}
                </button>
              ))}
              <button
                className="btn"
                type="button"
                onClick={() => setIsEditingDetails(true)}
                disabled={isSaving || isDeleting}
              >
                Edit Details
              </button>
            </div>
          </div>
        )}
        {!isReviewMode && (
          <>
            <div className="editor__field-group">
              <label>Contact</label>
              <select value={contactId} onChange={(event) => setContactId(event.target.value)} required>
                <option value="">Select contact</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contactName(contact)}
                  </option>
                ))}
              </select>
            </div>
            {estimate && (
              <div className="editor__field-group">
                <label>Status</label>
                <select value={status} onChange={(event) => setStatus(event.target.value as Estimate['status'])}>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="viewed">Viewed</option>
                  <option value="approved">Approved</option>
                  <option value="declined">Declined</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            )}
            <div className="editor__field-group">
              <label>Valid Until</label>
              <input type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
            </div>
            <div className="editor__field-group">
              <label>Tax Rate (%)</label>
              <input type="number" value={taxRate} onChange={(event) => setTaxRate(event.target.value)} />
            </div>
            <div className="editor__field-group">
              <label>Totals</label>
              <p>Subtotal: ${subtotal.toFixed(2)}</p>
              <p>Tax: ${tax.toFixed(2)}</p>
              <p>Total: ${total.toFixed(2)}</p>
            </div>
          </>
        )}
        {estimate?.id && (
          <div className="editor__field-group">
            <label>QuickBooks</label>
            <p>{estimate.qbo_estimate_id ? `Linked: ${estimate.qbo_estimate_id}` : 'Not linked yet'}</p>
            <button
              className="btn"
              type="button"
              onClick={handleQuickBooksSync}
              disabled={isSaving || isDeleting || isQuickBooksSyncing}
            >
              {isQuickBooksSyncing ? 'Syncing...' : estimate.qbo_estimate_id ? 'Update in QuickBooks' : 'Create in QuickBooks'}
            </button>
            {quickBooksMessage && <p>{quickBooksMessage}</p>}
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
        <div className="editor__field-group">
          {!isReviewMode && (
            <>
              <button
                className={`btn ${isDirty ? 'btn--primary' : 'btn--secondary'}`}
                type="submit"
                value="draft"
                disabled={isSaving || isDeleting}
              >
                {isSaving && saveMode === 'draft' ? 'Saving...' : 'Save as Draft'}
              </button>
              <button
                className={`btn ${isDirty ? 'btn--primary' : 'btn--secondary'}`}
                type="submit"
                value="send"
                disabled={isSaving || isDeleting || isCreatingInvoice}
              >
                {isSaving && saveMode === 'send' ? 'Saving & Sending...' : 'Save & Send'}
              </button>
            </>
          )}
          {estimate?.id && (
            <button
              className="btn"
              type="button"
              onClick={handleCreateInvoiceFromEstimate}
              disabled={isSaving || isDeleting || isCreatingInvoice}
            >
              {isCreatingInvoice ? 'Creating Invoice...' : 'Create Invoice'}
            </button>
          )}
          {estimate?.id && (
            <button
              className="btn"
              type="button"
              onClick={handleDelete}
              disabled={isSaving || isDeleting || isCreatingInvoice}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </aside>
    </form>
  );
}
