alter table public.custom_content_types
  add column if not exists entry_template_key text not null default 'custom-post-content-v1';
