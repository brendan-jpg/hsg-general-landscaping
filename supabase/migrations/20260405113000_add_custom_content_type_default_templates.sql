alter table public.custom_content_types
  add column if not exists default_h1_template text,
  add column if not exists default_url_template text;
