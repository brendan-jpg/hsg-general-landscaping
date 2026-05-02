alter table public.contacts
  add column if not exists source_submission_id uuid null references public.form_submissions(id) on delete set null;

create index if not exists contacts_source_submission_id_idx
  on public.contacts (source_submission_id)
  where source_submission_id is not null;

with direct_matches as (
  select distinct on (c.id)
    c.id as contact_id,
    fs.id as submission_id
  from public.contacts c
  join public.form_submissions fs
    on fs.contact_id = c.id
   and fs.business_id = c.business_id
  where c.source_submission_id is null
  order by c.id, abs(extract(epoch from (fs.created_at - c.created_at))), fs.created_at asc
),
timestamp_matches as (
  select distinct on (c.id)
    c.id as contact_id,
    fs.id as submission_id
  from public.contacts c
  join public.form_submissions fs
    on fs.business_id = c.business_id
   and fs.contact_id is null
   and c.source = 'website_form'
   and abs(extract(epoch from (fs.created_at - c.created_at))) <= 600
  where c.source_submission_id is null
  order by c.id, abs(extract(epoch from (fs.created_at - c.created_at))), fs.created_at asc
),
resolved as (
  select contact_id, submission_id from direct_matches
  union all
  select tm.contact_id, tm.submission_id
  from timestamp_matches tm
  where not exists (
    select 1
    from direct_matches dm
    where dm.contact_id = tm.contact_id
  )
)
update public.contacts c
set source_submission_id = resolved.submission_id
from resolved
where c.id = resolved.contact_id
  and c.source_submission_id is null;
