alter table public.services
  add column if not exists before_after_gallery_urls text[] not null default '{}'::text[],
  add column if not exists after_gallery_urls text[] not null default '{}'::text[],
  add column if not exists service_projects jsonb not null default '[]'::jsonb;
