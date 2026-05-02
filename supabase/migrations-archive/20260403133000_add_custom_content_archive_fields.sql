alter table public.custom_content_types
  add column if not exists archive_content jsonb not null default '[]'::jsonb,
  add column if not exists archive_meta_title text,
  add column if not exists archive_meta_description text,
  add column if not exists archive_og_image_url text;
