alter table public.services
  drop column if exists price_range_min,
  drop column if exists price_range_max;
