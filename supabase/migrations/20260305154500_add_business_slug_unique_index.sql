-- Ensure tenant slugs stay unique for routing/tooling consistency.

update public.businesses
set slug = coalesce(nullif(lower(trim(slug)), ''), 'business-' || substr(id::text, 1, 8));

with ranked_business_slugs as (
  select
    id,
    slug,
    row_number() over (
      partition by slug
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as rn
  from public.businesses
  where slug is not null
)
update public.businesses b
set slug = b.slug || '-' || substr(b.id::text, 1, 8)
from ranked_business_slugs r
where b.id = r.id
  and r.rn > 1;

create unique index if not exists businesses_slug_unique_idx
  on public.businesses (slug);
