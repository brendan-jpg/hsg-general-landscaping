create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  slug text not null,
  summary text,
  gallery_urls text[] not null default '{}'::text[],
  location text,
  review text,
  project_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_business_slug_key unique (business_id, slug)
);

create table if not exists public.project_services (
  project_id uuid not null references public.projects(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, service_id)
);

create index if not exists projects_business_id_idx
  on public.projects (business_id);

create index if not exists projects_active_date_idx
  on public.projects (business_id, project_date desc, created_at desc);

create index if not exists project_services_service_id_idx
  on public.project_services (service_id);

alter table public.projects enable row level security;
alter table public.project_services enable row level security;

grant select on public.projects to anon, authenticated;
grant insert, update, delete on public.projects to authenticated;
grant select on public.project_services to anon, authenticated;
grant insert, update, delete on public.project_services to authenticated;

create policy "projects_public_read"
  on public.projects
  for select
  to anon, authenticated
  using (true);

create policy "projects_authenticated_insert_own_business"
  on public.projects
  for insert
  to authenticated
  with check (
    business_id = (
      select p.business_id
      from public.profiles p
      where p.id = auth.uid()
    )
  );

create policy "projects_authenticated_update_own_business"
  on public.projects
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

create policy "projects_authenticated_delete_own_business"
  on public.projects
  for delete
  to authenticated
  using (
    business_id = (
      select p.business_id
      from public.profiles p
      where p.id = auth.uid()
    )
  );

create policy "project_services_public_read"
  on public.project_services
  for select
  to anon, authenticated
  using (true);

create policy "project_services_authenticated_write_own_business"
  on public.project_services
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.projects pr
      join public.services s on s.id = service_id and s.business_id = pr.business_id
      join public.profiles p on p.business_id = pr.business_id
      where pr.id = project_id
        and p.id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.projects pr
      join public.services s on s.id = service_id and s.business_id = pr.business_id
      join public.profiles p on p.business_id = pr.business_id
      where pr.id = project_id
        and p.id = auth.uid()
    )
  );
