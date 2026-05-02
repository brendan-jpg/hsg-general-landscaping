create table if not exists public.schedule_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  assigned_to uuid references public.profiles(id) on delete set null,
  related_job_id uuid references public.jobs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_items_time_order_check check (ends_at is null or ends_at >= starts_at)
);

create index if not exists schedule_items_business_id_idx
  on public.schedule_items (business_id);

create index if not exists schedule_items_starts_at_idx
  on public.schedule_items (business_id, starts_at asc);

create index if not exists schedule_items_assigned_to_idx
  on public.schedule_items (assigned_to, starts_at asc);

alter table public.schedule_items enable row level security;

grant select, insert, update, delete on public.schedule_items to authenticated;

create policy "schedule_items_authenticated_read_own_business"
  on public.schedule_items
  for select
  to authenticated
  using (
    business_id = (
      select p.business_id
      from public.profiles p
      where p.id = auth.uid()
    )
  );

create policy "schedule_items_authenticated_write_own_business"
  on public.schedule_items
  for all
  to authenticated
  using (
    business_id = (
      select p.business_id
      from public.profiles p
      where p.id = auth.uid()
    )
  )
  with check (
    business_id = (
      select p.business_id
      from public.profiles p
      where p.id = auth.uid()
    )
  );
