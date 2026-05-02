create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  title text,
  bio text,
  photo_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists team_members_business_id_idx
  on public.team_members (business_id);

create index if not exists team_members_sort_order_idx
  on public.team_members (business_id, sort_order, name);

alter table public.team_members enable row level security;

grant select on public.team_members to anon, authenticated;
grant insert, update, delete on public.team_members to authenticated;

create policy "team_members_public_read"
  on public.team_members
  for select
  to anon, authenticated
  using (true);

create policy "team_members_authenticated_insert_own_business"
  on public.team_members
  for insert
  to authenticated
  with check (
    business_id = (
      select p.business_id
      from public.profiles p
      where p.id = auth.uid()
    )
  );

create policy "team_members_authenticated_update_own_business"
  on public.team_members
  for update
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

create policy "team_members_authenticated_delete_own_business"
  on public.team_members
  for delete
  to authenticated
  using (
    business_id = (
      select p.business_id
      from public.profiles p
      where p.id = auth.uid()
    )
  );
