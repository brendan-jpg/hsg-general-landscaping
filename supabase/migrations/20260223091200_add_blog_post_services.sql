create table if not exists public.blog_post_services (
  blog_post_id uuid not null references public.blog_posts(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blog_post_id, service_id)
);

create index if not exists blog_post_services_service_id_idx
  on public.blog_post_services (service_id);

alter table public.blog_post_services enable row level security;

grant select on public.blog_post_services to anon, authenticated;
grant insert, update, delete on public.blog_post_services to authenticated;

create policy "blog_post_services_public_read"
  on public.blog_post_services
  for select
  to anon, authenticated
  using (true);

create policy "blog_post_services_authenticated_write_own_business"
  on public.blog_post_services
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.blog_posts bp
      join public.services s on s.id = service_id and s.business_id = bp.business_id
      join public.profiles p on p.business_id = bp.business_id
      where bp.id = blog_post_id
        and p.id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.blog_posts bp
      join public.services s on s.id = service_id and s.business_id = bp.business_id
      join public.profiles p on p.business_id = bp.business_id
      where bp.id = blog_post_id
        and p.id = auth.uid()
    )
  );
