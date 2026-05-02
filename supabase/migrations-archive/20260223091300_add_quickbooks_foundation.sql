create table if not exists public.quickbooks_connections (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  realm_id text not null unique,
  company_name text,
  access_token text not null,
  refresh_token text not null,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  token_type text,
  scope text,
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_quickbooks_connections_updated_at
before update on public.quickbooks_connections
for each row execute function update_updated_at();

alter table public.quickbooks_connections enable row level security;
grant select, insert, update, delete on public.quickbooks_connections to authenticated;

create policy "quickbooks_connections_authenticated_own_business"
  on public.quickbooks_connections
  for all
  to authenticated
  using (
    business_id = (
      select p.business_id from public.profiles p where p.id = auth.uid()
    )
  )
  with check (
    business_id = (
      select p.business_id from public.profiles p where p.id = auth.uid()
    )
  );

alter table public.contacts add column if not exists qbo_customer_id text;
alter table public.estimates add column if not exists qbo_estimate_id text;
alter table public.invoices add column if not exists qbo_invoice_id text;
alter table public.payments add column if not exists qbo_payment_id text;

create index if not exists contacts_qbo_customer_id_idx on public.contacts (qbo_customer_id);
create index if not exists estimates_qbo_estimate_id_idx on public.estimates (qbo_estimate_id);
create index if not exists invoices_qbo_invoice_id_idx on public.invoices (qbo_invoice_id);
create index if not exists payments_qbo_payment_id_idx on public.payments (qbo_payment_id);
