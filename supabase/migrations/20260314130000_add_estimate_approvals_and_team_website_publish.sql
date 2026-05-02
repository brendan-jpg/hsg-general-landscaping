alter table public.team_members
  add column if not exists website_published boolean not null default true;

alter table public.estimates
  add column if not exists approval_token text,
  add column if not exists estimate_version integer not null default 1;

update public.estimates
set approval_token = gen_random_uuid()::text
where approval_token is null or approval_token = '';

alter table public.estimates
  alter column approval_token set default gen_random_uuid()::text;

create unique index if not exists estimates_approval_token_idx
  on public.estimates (approval_token);

create table if not exists public.estimate_approvals (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  estimate_version integer not null default 1,
  customer_name text not null,
  ip_address text,
  user_agent text,
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists estimate_approvals_business_id_idx
  on public.estimate_approvals (business_id, approved_at desc);

create index if not exists estimate_approvals_estimate_id_idx
  on public.estimate_approvals (estimate_id, approved_at desc);

alter table public.estimate_approvals enable row level security;

grant select, insert on public.estimate_approvals to authenticated;

drop policy if exists "estimate_approvals_authenticated_read_own_business" on public.estimate_approvals;
create policy "estimate_approvals_authenticated_read_own_business"
  on public.estimate_approvals
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.business_id = estimate_approvals.business_id
    )
  );
