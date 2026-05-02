alter table public.services
  add column if not exists is_primary boolean not null default false;

create unique index if not exists services_one_primary_per_business_idx
  on public.services (business_id)
  where is_primary = true;
