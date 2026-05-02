with ranked_matches as (
  select
    fs.id as submission_id,
    c.id as contact_id,
    row_number() over (
      partition by fs.id
      order by abs(extract(epoch from (fs.created_at - c.created_at)))
    ) as submission_rank,
    row_number() over (
      partition by c.id
      order by abs(extract(epoch from (fs.created_at - c.created_at)))
    ) as contact_rank,
    abs(extract(epoch from (fs.created_at - c.created_at))) as seconds_apart
  from public.form_submissions fs
  join public.contacts c
    on c.business_id = fs.business_id
   and c.source = 'website_form'
   and fs.contact_id is null
   and abs(extract(epoch from (fs.created_at - c.created_at))) <= 600
  where fs.contact_id is null
),
unique_matches as (
  select submission_id, contact_id
  from ranked_matches
  where submission_rank = 1
    and contact_rank = 1
    and seconds_apart <= 600
)
update public.form_submissions fs
set contact_id = unique_matches.contact_id
from unique_matches
where fs.id = unique_matches.submission_id
  and fs.contact_id is null;
