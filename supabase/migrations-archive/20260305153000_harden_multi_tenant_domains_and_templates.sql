-- Multi-tenant hardening:
-- 1) Add business_domains table for domain aliases + canonical host control.
-- 2) Enforce unique template names per business.
-- 3) Normalize + constrain legacy businesses.domain values.

create table if not exists public.business_domains (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  domain text not null,
  canonical_domain text null,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_domains_domain_not_blank check (length(trim(domain)) > 0)
);

alter table public.business_domains enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'business_domains'
      and policyname = 'business_domains_public_select_active'
  ) then
    create policy business_domains_public_select_active
      on public.business_domains
      for select
      using (is_active = true);
  end if;
end $$;

create index if not exists business_domains_business_id_idx
  on public.business_domains (business_id);

create unique index if not exists business_domains_domain_unique_idx
  on public.business_domains (lower(trim(domain)))
  where is_active = true;

create unique index if not exists business_domains_primary_per_business_idx
  on public.business_domains (business_id)
  where is_primary = true and is_active = true;

create or replace function public.normalize_business_domains_fields()
returns trigger
language plpgsql
as $$
begin
  new.domain := lower(trim(new.domain));
  if new.canonical_domain is not null then
    new.canonical_domain := nullif(lower(trim(new.canonical_domain)), '');
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists business_domains_normalize_fields_trigger on public.business_domains;
create trigger business_domains_normalize_fields_trigger
before insert or update on public.business_domains
for each row execute function public.normalize_business_domains_fields();

-- Backfill aliases from existing businesses.domain.
insert into public.business_domains (business_id, domain, canonical_domain, is_primary, is_active)
select
  b.id,
  lower(trim(b.domain)),
  lower(trim(b.domain)),
  true,
  true
from public.businesses b
where b.domain is not null
  and trim(b.domain) <> ''
on conflict do nothing;

-- Keep only the newest template per (business, name), then enforce uniqueness.
with ranked_templates as (
  select
    id,
    row_number() over (
      partition by business_id, lower(trim(name))
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as rn
  from public.email_templates
)
delete from public.email_templates t
using ranked_templates r
where t.id = r.id
  and r.rn > 1;

create unique index if not exists email_templates_business_name_unique_idx
  on public.email_templates (business_id, lower(trim(name)));

-- Normalize legacy businesses.domain and avoid collisions before adding uniqueness.
update public.businesses
set domain = nullif(lower(trim(domain)), '');

with ranked_business_domains as (
  select
    id,
    row_number() over (
      partition by domain
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as rn
  from public.businesses
  where domain is not null
)
update public.businesses b
set domain = null
from ranked_business_domains r
where b.id = r.id
  and r.rn > 1;

create unique index if not exists businesses_domain_unique_idx
  on public.businesses (domain)
  where domain is not null;
