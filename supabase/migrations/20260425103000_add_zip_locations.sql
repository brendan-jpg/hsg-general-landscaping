create table if not exists public.zip_locations (
  zip text primary key,
  city text not null,
  state_id text not null,
  state_name text not null,
  lat double precision not null,
  lng double precision not null,
  population integer null,
  county_name text null,
  timezone text null,
  imprecise boolean not null default false,
  military boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zip_locations_zip_format check (zip ~ '^[0-9]{5}$')
);

create index if not exists zip_locations_state_city_idx on public.zip_locations (state_id, city);
create index if not exists zip_locations_lat_idx on public.zip_locations (lat);
create index if not exists zip_locations_lng_idx on public.zip_locations (lng);

alter table public.zip_locations enable row level security;

create policy "zip_locations readable by authenticated users"
on public.zip_locations
for select
to authenticated
using (true);
