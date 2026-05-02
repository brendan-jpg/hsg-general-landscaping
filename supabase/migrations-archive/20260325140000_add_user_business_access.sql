create table if not exists public.user_business_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  role public.user_role not null default 'admin',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, business_id)
);

create index if not exists user_business_access_user_id_idx on public.user_business_access (user_id);
create index if not exists user_business_access_business_id_idx on public.user_business_access (business_id);

drop trigger if exists set_user_business_access_updated_at on public.user_business_access;
create trigger set_user_business_access_updated_at
before update on public.user_business_access
for each row execute function update_updated_at();

alter table public.user_business_access enable row level security;

grant select on public.user_business_access to authenticated;

create policy "user_business_access_authenticated_read_own_rows"
  on public.user_business_access
  for select
  to authenticated
  using (user_id = auth.uid());
