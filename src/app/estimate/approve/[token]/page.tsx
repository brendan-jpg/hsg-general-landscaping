import { notFound } from 'next/navigation';
import { approveEstimateByTokenAction } from '@/lib/actions';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatDateTime } from '@/lib/utils';
import type { Json } from '@/lib/types/database';

interface LineItem {
  description: string;
  qty: number;
  unit_price: number;
  total: number;
}

function parseLineItems(value: Json | null | undefined): LineItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const row = item as Record<string, unknown>;
      const qty = Number(row.qty ?? 0);
      const unitPrice = Number(row.unit_price ?? 0);
      return {
        description: String(row.description ?? '').trim(),
        qty: Number.isFinite(qty) ? qty : 0,
        unit_price: Number.isFinite(unitPrice) ? unitPrice : 0,
        total: Number.isFinite(Number(row.total)) ? Number(row.total) : qty * unitPrice,
      };
    })
    .filter((item): item is LineItem => item !== null && item.description.length > 0);
}

interface EstimateApprovePageProps {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ approved?: string; v?: string }>;
}

export default async function EstimateApprovePage({ params, searchParams }: EstimateApprovePageProps) {
  const { token } = await params;
  const query = searchParams ? await searchParams : {};
  const admin = createAdminClient();

  const { data: estimate, error } = await admin
    .from('estimates')
    .select('id, business_id, estimate_number, total, valid_until, status, approved_at, estimate_version, notes, line_items, contacts(first_name,last_name,email)')
    .eq('approval_token', token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!estimate) notFound();

  if (estimate.status === 'sent') {
    await admin
      .from('estimates')
      .update({ status: 'viewed' })
      .eq('id', estimate.id)
      .eq('business_id', estimate.business_id);
  }

  const lineItems = parseLineItems(estimate.line_items as Json | null | undefined);
  const contact = Array.isArray(estimate.contacts) ? estimate.contacts[0] : estimate.contacts;
  const defaultCustomerName =
    [contact?.first_name, contact?.last_name].filter(Boolean).join(' ').trim() ||
    contact?.email ||
    '';
  const requestedVersion = Math.max(1, parseInt(query.v ?? '', 10) || estimate.estimate_version || 1);

  return (
    <main className="page" style={{ maxWidth: '840px', margin: '0 auto', padding: '3rem 1.25rem 4rem' }}>
      <div className="page-section" style={{ display: 'grid', gap: '1.5rem' }}>
        <header style={{ display: 'grid', gap: '0.5rem' }}>
          <p style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.85rem' }}>
            Estimate Approval
          </p>
          <h1 style={{ margin: 0 }}>{estimate.estimate_number}</h1>
          <p style={{ margin: 0 }}>
            Total: <strong>${Number(estimate.total ?? 0).toFixed(2)}</strong>
            {estimate.valid_until ? ` • Valid until ${estimate.valid_until}` : ''}
          </p>
          {requestedVersion !== estimate.estimate_version && (
            <p style={{ margin: 0 }}>
              This link references estimate version {requestedVersion}. The current version is {estimate.estimate_version}.
            </p>
          )}
        </header>

        <section style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1rem' }}>
          <h2 style={{ marginTop: 0 }}>Estimate Summary</h2>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {lineItems.map((item, index) => (
              <div key={`${item.description}-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0.75rem' }}>
                <span>{item.description}</span>
                <span>{item.qty}</span>
                <span>${item.unit_price.toFixed(2)}</span>
                <strong>${item.total.toFixed(2)}</strong>
              </div>
            ))}
          </div>
          {estimate.notes && (
            <div style={{ marginTop: '1rem' }}>
              <h3 style={{ marginBottom: '0.5rem' }}>Notes</h3>
              <p style={{ margin: 0 }}>{estimate.notes}</p>
            </div>
          )}
        </section>

        {query.approved === '1' || estimate.status === 'approved' ? (
          <section style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1rem' }}>
            <h2 style={{ marginTop: 0 }}>Estimate Approved</h2>
            <p style={{ marginBottom: 0 }}>
              Thanks. Your approval has been recorded{estimate.approved_at ? ` on ${formatDateTime(estimate.approved_at)}` : ''}.
            </p>
          </section>
        ) : (
          <form
            action={async (formData) => {
              'use server';
              await approveEstimateByTokenAction(token, formData);
            }}
            style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1rem', display: 'grid', gap: '1rem' }}
          >
            <input type="hidden" name="estimate_version" value={String(requestedVersion)} />
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <label htmlFor="customer_name">Your Name</label>
              <input
                id="customer_name"
                name="customer_name"
                type="text"
                defaultValue={defaultCustomerName}
                required
                style={{ padding: '0.75rem 0.9rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}
              />
            </div>
            <button type="submit" className="btn btn--primary">
              Approve Estimate
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
