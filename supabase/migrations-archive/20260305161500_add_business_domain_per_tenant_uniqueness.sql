-- Prevent duplicate domain rows within the same business.

with ranked as (
  select
    id,
    row_number() over (
      partition by business_id, lower(trim(domain))
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as rn
  from public.business_domains
)
delete from public.business_domains d
using ranked r
where d.id = r.id
  and r.rn > 1;

create unique index if not exists business_domains_business_domain_unique_idx
  on public.business_domains (business_id, lower(trim(domain)));
