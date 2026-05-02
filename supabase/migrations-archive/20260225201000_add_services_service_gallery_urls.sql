alter table public.services
add column if not exists service_gallery_urls text[] not null default '{}'::text[];
