alter table public.email_templates
  drop column if exists type;

drop type if exists public.email_template_type;
