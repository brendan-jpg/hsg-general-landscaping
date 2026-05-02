'use client';

import { FormEvent, useMemo, useState } from 'react';
import EditorSaveButton from '@/components/backend/EditorSaveButton';
import { useRouter } from 'next/navigation';
import {
  deleteInvoice,
  refreshQuickBooksInvoiceStatusAction,
  saveInvoice,
  syncQuickBooksInvoiceAction,
} from '@/lib/actions';
import useDirtyState from '@/components/backend/useDirtyState';
import type { LineItem } from '@/lib/types';
import type { Tables } from '@/lib/types/database';

type Invoice = Tables<'invoices'>;

interface InvoiceEditorFormProps {
  invoice: Invoice | null;
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

export default function InvoiceEditorForm({
  invoice,
  contacts,
  initialContactId,
  quickBooksItems,
  defaultTaxRate,
}: InvoiceEditorFormProps) {
  const router = useRouter();
  const [invoiceNumber, setInvoiceNumber] = useState(invoice?.invoice_number ?? '');
  const [contactId, setContactId] = useState(invoice?.contact_id ?? initialContactId ?? '');
  const [dueDate, setDueDate] = useState(invoice?.due_date ?? '');
  const [taxRate, setTaxRate] = useState(String(invoice?.tax_rate ?? defaultTaxRate ?? 0));
  const [amountPaid, setAmountPaid] = useState(String(invoice?.amount_paid ?? 0));
  const [notes, setNotes] = useState(invoice?.notes ?? '');
  const [lineItems, setLineItems] = useState<LineItem[]>(() => {
    const parsed = parseLineItems(invoice?.line_items);
    return parsed.length > 0 ? parsed : [{ description: '', qty: 1, unit_price: 0, total: 0, qbo_item_id: null, qbo_item_name: null }];
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isQuickBooksSyncing, setIsQuickBooksSyncing] = useState(false);
  const [isQuickBooksRefreshing, setIsQuickBooksRefreshing] = useState(false);
  const [quickBooksMessage, setQuickBooksMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const subtotal = useMemo(() => lineItems.reduce((sum, item) => sum + item.qty * item.unit_price, 0), [lineItems]);
  const tax = useMemo(() => subtotal * ((Number(taxRate) || 0) / 100), [subtotal, taxRate]);
  const total = subtotal + tax;
  const isDirty = useDirtyState({
    invoiceNumber,
    contactId,
    dueDate,
    taxRate,
    amountPaid,
    notes,
    lineItems,
  });

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
      const formData = new FormData();
      if (invoice?.id) formData.set('id', invoice.id);
      formData.set('invoice_number', invoiceNumber);
      formData.set('contact_id', contactId);
      formData.set('due_date', dueDate);
      formData.set('tax_rate', taxRate);
      formData.set('amount_paid', amountPaid);
      formData.set('notes', notes);
      formData.set('line_items', JSON.stringify(lineItems));

      await saveInvoice(formData);
      router.push('/dashboard/invoices');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save invoice');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!invoice?.id) return;
    if (!window.confirm('Delete this invoice? This cannot be undone.')) return;

    setError(null);
    setIsDeleting(true);
    try {
      await deleteInvoice(invoice.id);
      router.push('/dashboard/invoices');
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete invoice');
      setIsDeleting(false);
    }
  }

  async function handleQuickBooksSync() {
    if (!invoice?.id) return;
    setError(null);
    setQuickBooksMessage(null);
    setIsQuickBooksSyncing(true);
    try {
      const result = await syncQuickBooksInvoiceAction(invoice.id);
      setQuickBooksMessage(
        result.created
          ? `QuickBooks invoice created (${result.qboInvoiceId})`
          : `QuickBooks invoice updated (${result.qboInvoiceId})`
      );
      router.refresh();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'Unable to sync invoice to QuickBooks');
    } finally {
      setIsQuickBooksSyncing(false);
    }
  }

  async function handleQuickBooksRefresh() {
    if (!invoice?.id) return;
    setError(null);
    setQuickBooksMessage(null);
    setIsQuickBooksRefreshing(true);
    try {
      const result = await refreshQuickBooksInvoiceStatusAction(invoice.id);
      setQuickBooksMessage(
        `QuickBooks status synced (${result.status}, paid ${Number(result.amountPaid).toFixed(2)} / ${Number(result.total).toFixed(2)})`
      );
      router.refresh();
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh QuickBooks invoice status');
    } finally {
      setIsQuickBooksRefreshing(false);
    }
  }

  return (
    <form className="editor" onSubmit={handleSubmit}>
      <div className="editor__main">
        <input
          className="editor__title-input"
          type="text"
          placeholder="Invoice number (auto if blank)"
          value={invoiceNumber}
          onChange={(event) => setInvoiceNumber(event.target.value)}
        />
        <div className="editor__field-group">
          <label>Line Items</label>
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
                <button className="btn" type="button" onClick={() => setLineItems((current) => current.filter((_, i) => i !== index))}>
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
      </div>
      <aside className="editor__sidebar">
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
        <div className="editor__field-group">
          <label>Status</label>
          <p>
            {invoice?.status
              ? `Current status: ${invoice.status}`
              : 'Status is set automatically (new invoices start as draft).'}
          </p>
        </div>
        <div className="editor__field-group">
          <label>Due Date</label>
          <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </div>
        <div className="editor__field-group">
          <label>Tax Rate (%)</label>
          <input type="number" value={taxRate} onChange={(event) => setTaxRate(event.target.value)} />
        </div>
        <div className="editor__field-group">
          <label>Amount Paid</label>
          <input type="number" value={amountPaid} onChange={(event) => setAmountPaid(event.target.value)} />
        </div>
        <div className="editor__field-group">
          <label>Totals</label>
          <p>Subtotal: ${subtotal.toFixed(2)}</p>
          <p>Tax: ${tax.toFixed(2)}</p>
          <p>Total: ${total.toFixed(2)}</p>
        </div>
        {invoice?.id && (
          <div className="editor__field-group">
            <label>QuickBooks</label>
            <p>{invoice.qbo_invoice_id ? `Linked: ${invoice.qbo_invoice_id}` : 'Not linked yet'}</p>
            <button
              className="btn"
              type="button"
              onClick={handleQuickBooksSync}
              disabled={isSaving || isDeleting || isQuickBooksSyncing || isQuickBooksRefreshing}
            >
              {isQuickBooksSyncing ? 'Syncing...' : invoice.qbo_invoice_id ? 'Update in QuickBooks' : 'Create in QuickBooks'}
            </button>
            {invoice.qbo_invoice_id && (
              <button
                className="btn"
                type="button"
                onClick={handleQuickBooksRefresh}
                disabled={isSaving || isDeleting || isQuickBooksSyncing || isQuickBooksRefreshing}
              >
                {isQuickBooksRefreshing ? 'Refreshing...' : 'Refresh QuickBooks Status'}
              </button>
            )}
            {quickBooksMessage && <p>{quickBooksMessage}</p>}
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
        <div className="editor__field-group">
          <EditorSaveButton isDirty={isDirty} isSaving={isSaving} disabled={isSaving || isDeleting} />
          {invoice?.id && (
            <button className="btn" type="button" onClick={handleDelete} disabled={isSaving || isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </aside>
    </form>
  );
}
