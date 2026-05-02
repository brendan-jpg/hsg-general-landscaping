create index if not exists contacts_business_name_address_idx
  on public.contacts (business_id, lower(first_name), lower(last_name), lower(address_line1))
  where first_name is not null
    and btrim(first_name) <> ''
    and last_name is not null
    and btrim(last_name) <> ''
    and address_line1 is not null
    and btrim(address_line1) <> '';

create index if not exists contacts_business_name_city_idx
  on public.contacts (business_id, lower(first_name), lower(last_name), lower(city))
  where first_name is not null
    and btrim(first_name) <> ''
    and last_name is not null
    and btrim(last_name) <> ''
    and city is not null
    and btrim(city) <> '';

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
          and lower(coalesce(c.email, '')) = lower(btrim(coalesce(fs.data ->> 'email', fs.data ->> 'email_address', '')))
        )
        or
        (
          regexp_replace(coalesce(fs.data ->> 'phone', fs.data ->> 'phone_number', fs.data ->> 'phoneNumber', fs.data ->> 'mobile', ''), '\D', '', 'g') <> ''
          and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') =
              regexp_replace(coalesce(fs.data ->> 'phone', fs.data ->> 'phone_number', fs.data ->> 'phoneNumber', fs.data ->> 'mobile', ''), '\D', '', 'g')
        )
        or
        (
          lower(btrim(coalesce(fs.data ->> 'first_name', fs.data ->> 'firstname', fs.data ->> 'firstName', fs.data ->> 'given_name', ''))) <> ''
          and lower(btrim(coalesce(fs.data ->> 'last_name', fs.data ->> 'lastname', fs.data ->> 'lastName', fs.data ->> 'family_name', fs.data ->> 'surname', ''))) <> ''
          and lower(btrim(coalesce(c.first_name, ''))) =
              lower(btrim(coalesce(fs.data ->> 'first_name', fs.data ->> 'firstname', fs.data ->> 'firstName', fs.data ->> 'given_name', '')))
          and lower(btrim(coalesce(c.last_name, ''))) =
              lower(btrim(coalesce(fs.data ->> 'last_name', fs.data ->> 'lastname', fs.data ->> 'lastName', fs.data ->> 'family_name', fs.data ->> 'surname', '')))
          and lower(btrim(coalesce(c.address_line1, ''))) <> ''
          and lower(btrim(coalesce(c.address_line1, ''))) =
              lower(
                btrim(
                  coalesce(
                    fs.data ->> 'address_line1',
                    fs.data ->> 'address',
                    fs.data ->> 'street_address',
                    fs.data ->> 'service_address',
                    fs.data ->> 'property_address',
                    ''
                  )
                )
              )
        )
        or
        (
          lower(btrim(coalesce(fs.data ->> 'first_name', fs.data ->> 'firstname', fs.data ->> 'firstName', fs.data ->> 'given_name', ''))) <> ''
          and lower(btrim(coalesce(fs.data ->> 'last_name', fs.data ->> 'lastname', fs.data ->> 'lastName', fs.data ->> 'family_name', fs.data ->> 'surname', ''))) <> ''
          and lower(btrim(coalesce(c.first_name, ''))) =
              lower(btrim(coalesce(fs.data ->> 'first_name', fs.data ->> 'firstname', fs.data ->> 'firstName', fs.data ->> 'given_name', '')))
          and lower(btrim(coalesce(c.last_name, ''))) =
              lower(btrim(coalesce(fs.data ->> 'last_name', fs.data ->> 'lastname', fs.data ->> 'lastName', fs.data ->> 'family_name', fs.data ->> 'surname', '')))
          and lower(btrim(coalesce(c.city, ''))) <> ''
          and lower(btrim(coalesce(c.city, ''))) = lower(btrim(coalesce(fs.data ->> 'city', '')))
        )
        or
        (
          lower(btrim(coalesce(fs.data ->> 'name', fs.data ->> 'full_name', fs.data ->> 'fullName', ''))) <> ''
          and lower(btrim(concat_ws(' ', coalesce(c.first_name, ''), coalesce(c.last_name, '')))) =
              lower(btrim(coalesce(fs.data ->> 'name', fs.data ->> 'full_name', fs.data ->> 'fullName', '')))
          and lower(btrim(coalesce(c.address_line1, ''))) <> ''
          and lower(btrim(coalesce(c.address_line1, ''))) =
              lower(
                btrim(
                  coalesce(
                    fs.data ->> 'address_line1',
                    fs.data ->> 'address',
                    fs.data ->> 'street_address',
                    fs.data ->> 'service_address',
                    fs.data ->> 'property_address',
                    ''
                  )
                )
              )
        )
      )
    order by
      case
        when lower(btrim(coalesce(fs.data ->> 'email', fs.data ->> 'email_address', ''))) <> ''
          and lower(coalesce(c.email, '')) = lower(btrim(coalesce(fs.data ->> 'email', fs.data ->> 'email_address', '')))
        then 0
        when regexp_replace(coalesce(fs.data ->> 'phone', fs.data ->> 'phone_number', fs.data ->> 'phoneNumber', fs.data ->> 'mobile', ''), '\D', '', 'g') <> ''
          and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') =
              regexp_replace(coalesce(fs.data ->> 'phone', fs.data ->> 'phone_number', fs.data ->> 'phoneNumber', fs.data ->> 'mobile', ''), '\D', '', 'g')
        then 1
        else 2
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
