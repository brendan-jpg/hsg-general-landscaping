create index if not exists form_submissions_business_contact_created_idx
  on public.form_submissions (business_id, contact_id, created_at desc);

create index if not exists contacts_business_lower_email_idx
  on public.contacts (business_id, lower(email))
  where email is not null and btrim(email) <> '';

create index if not exists contacts_business_normalized_phone_idx
  on public.contacts (business_id, regexp_replace(phone, '\D', '', 'g'))
  where phone is not null and btrim(phone) <> '';

with candidate_matches as (
  select
    fs.id as submission_id,
    match.contact_id
  from public.form_submissions fs
  join lateral (
    select c.id as contact_id
    from public.contacts c
    where c.business_id = fs.business_id
      and (
        (
          lower(btrim(coalesce(fs.data ->> 'email', fs.data ->> 'email_address', ''))) <> ''
          and lower(c.email) = lower(btrim(coalesce(fs.data ->> 'email', fs.data ->> 'email_address', '')))
        )
        or
        (
          regexp_replace(coalesce(fs.data ->> 'phone', fs.data ->> 'phone_number', fs.data ->> 'phoneNumber', fs.data ->> 'mobile', ''), '\D', '', 'g') <> ''
          and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') =
              regexp_replace(coalesce(fs.data ->> 'phone', fs.data ->> 'phone_number', fs.data ->> 'phoneNumber', fs.data ->> 'mobile', ''), '\D', '', 'g')
        )
      )
    order by
      case
        when lower(btrim(coalesce(fs.data ->> 'email', fs.data ->> 'email_address', ''))) <> ''
          and lower(c.email) = lower(btrim(coalesce(fs.data ->> 'email', fs.data ->> 'email_address', '')))
        then 0
        else 1
      end,
      c.created_at desc
    limit 1
  ) match on true
  where fs.contact_id is null
)
update public.form_submissions fs
set contact_id = candidate_matches.contact_id
from candidate_matches
where fs.id = candidate_matches.submission_id
  and fs.contact_id is null;
