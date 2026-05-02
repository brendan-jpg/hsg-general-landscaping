alter table public.service_areas
  drop column if exists zip_codes,
  drop column if exists latitude,
  drop column if exists longitude,
  drop column if exists radius_miles;
