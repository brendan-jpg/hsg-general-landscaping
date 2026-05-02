alter table public.seo_settings
  drop column if exists robots_txt,
  drop column if exists schema_org_data;
