do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'us_state_code'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.us_state_code as enum (
      'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
      'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
      'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
    );
  end if;
end
$$;

update public.businesses
set state = upper(trim(state))
where state is not null;

update public.businesses
set state = null
where state is not null
  and state not in (
    'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
    'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
    'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
  );

alter table public.businesses
alter column state type public.us_state_code
using state::public.us_state_code;
