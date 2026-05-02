-- Prevent duplicate service slugs within a business and enforce uniqueness.

update public.services
set slug = coalesce(nullif(lower(trim(slug)), ''), 'service-' || substr(id::text, 1, 8));

with ranked as (
  select
    id,
    business_id,
    slug,
    row_number() over (
      partition by business_id, slug
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as rn,
    first_value(id) over (
      partition by business_id, slug
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as canonical_id
  from public.services
),
dupes as (
  select id as duplicate_id, canonical_id
  from ranked
  where rn > 1
)
update public.blog_post_services bps
set service_id = d.canonical_id
from dupes d
where bps.service_id = d.duplicate_id;

with ranked as (
  select
    id,
    business_id,
    slug,
    row_number() over (
      partition by business_id, slug
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as rn,
    first_value(id) over (
      partition by business_id, slug
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as canonical_id
  from public.services
),
dupes as (
  select id as duplicate_id, canonical_id
  from ranked
  where rn > 1
)
update public.faq_services fs
set service_id = d.canonical_id
from dupes d
where fs.service_id = d.duplicate_id;

with ranked as (
  select
    id,
    business_id,
    slug,
    row_number() over (
      partition by business_id, slug
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as rn,
    first_value(id) over (
      partition by business_id, slug
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as canonical_id
  from public.services
),
dupes as (
  select id as duplicate_id, canonical_id
  from ranked
  where rn > 1
)
update public.galleries g
set service_id = d.canonical_id
from dupes d
where g.service_id = d.duplicate_id;

with ranked as (
  select
    id,
    business_id,
    slug,
    row_number() over (
      partition by business_id, slug
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as rn,
    first_value(id) over (
      partition by business_id, slug
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as canonical_id
  from public.services
),
dupes as (
  select id as duplicate_id, canonical_id
  from ranked
  where rn > 1
)
update public.jobs j
set service_id = d.canonical_id
from dupes d
where j.service_id = d.duplicate_id;

with ranked as (
  select
    id,
    business_id,
    slug,
    row_number() over (
      partition by business_id, slug
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as rn,
    first_value(id) over (
      partition by business_id, slug
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as canonical_id
  from public.services
),
dupes as (
  select id as duplicate_id, canonical_id
  from ranked
  where rn > 1
)
update public.project_services ps
set service_id = d.canonical_id
from dupes d
where ps.service_id = d.duplicate_id;

do $$
begin
  if to_regclass('public.service_area_services') is not null then
    with ranked as (
      select
        id,
        business_id,
        slug,
        row_number() over (
          partition by business_id, slug
          order by updated_at desc nulls last, created_at desc nulls last, id desc
        ) as rn,
        first_value(id) over (
          partition by business_id, slug
          order by updated_at desc nulls last, created_at desc nulls last, id desc
        ) as canonical_id
      from public.services
    ),
    dupes as (
      select id as duplicate_id, canonical_id
      from ranked
      where rn > 1
    )
    update public.service_area_services sas
    set service_id = d.canonical_id
    from dupes d
    where sas.service_id = d.duplicate_id;
  end if;
end $$;

with ranked as (
  select
    id,
    business_id,
    slug,
    row_number() over (
      partition by business_id, slug
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as rn,
    first_value(id) over (
      partition by business_id, slug
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as canonical_id
  from public.services
),
dupes as (
  select id as duplicate_id, canonical_id
  from ranked
  where rn > 1
)
update public.testimonials t
set service_id = d.canonical_id
from dupes d
where t.service_id = d.duplicate_id;

with ranked as (
  select
    id,
    business_id,
    slug,
    row_number() over (
      partition by business_id, slug
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as rn,
    first_value(id) over (
      partition by business_id, slug
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as canonical_id
  from public.services
),
dupes as (
  select id as duplicate_id, canonical_id
  from ranked
  where rn > 1
)
update public.services s
set parent_service_id = d.canonical_id
from dupes d
where s.parent_service_id = d.duplicate_id;

with ranked as (
  select
    id,
    business_id,
    slug,
    row_number() over (
      partition by business_id, slug
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as rn
  from public.services
)
delete from public.services s
using ranked r
where s.id = r.id
  and r.rn > 1;

create unique index if not exists services_business_slug_unique_idx
  on public.services (business_id, slug);
