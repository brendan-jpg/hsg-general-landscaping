create table if not exists public.forms (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  fields jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, slug)
);

create index if not exists forms_business_id_idx on public.forms (business_id);
create index if not exists forms_business_slug_idx on public.forms (business_id, slug);

drop trigger if exists set_forms_updated_at on public.forms;
create trigger set_forms_updated_at
before update on public.forms
for each row execute function update_updated_at();

alter table public.forms enable row level security;

grant select, insert, update, delete on public.forms to authenticated;

create policy "forms_authenticated_read_own_business"
  on public.forms
  for select
  to authenticated
  using (
    business_id = (
      select p.business_id
      from public.profiles p
      where p.id = auth.uid()
    )
  );

create policy "forms_authenticated_insert_own_business"
  on public.forms
  for insert
  to authenticated
  with check (
    business_id = (
      select p.business_id
      from public.profiles p
      where p.id = auth.uid()
    )
  );

create policy "forms_authenticated_update_own_business"
  on public.forms
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

create policy "forms_authenticated_delete_own_business"
  on public.forms
  for delete
  to authenticated
  using (
    business_id = (
      select p.business_id
      from public.profiles p
      where p.id = auth.uid()
    )
  );
