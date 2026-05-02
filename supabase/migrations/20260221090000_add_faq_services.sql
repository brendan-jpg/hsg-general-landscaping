create table if not exists public.faq_services (
  faq_id uuid not null references public.faqs(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (faq_id, service_id)
);

create index if not exists faq_services_service_id_idx
  on public.faq_services (service_id);

alter table public.faq_services enable row level security;

grant select on public.faq_services to anon, authenticated;
grant insert, update, delete on public.faq_services to authenticated;

create policy "faq_services_public_read"
  on public.faq_services
  for select
  to anon, authenticated
  using (true);

create policy "faq_services_authenticated_write_own_business"
  on public.faq_services
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.faqs f
      join public.services s on s.id = service_id and s.business_id = f.business_id
      join public.profiles p on p.business_id = f.business_id
      where f.id = faq_id
        and p.id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.faqs f
      join public.services s on s.id = service_id and s.business_id = f.business_id
      join public.profiles p on p.business_id = f.business_id
      where f.id = faq_id
        and p.id = auth.uid()
    )
  );
