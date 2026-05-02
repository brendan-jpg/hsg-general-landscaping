alter table public.forms
add column if not exists auto_response_template_id uuid null references public.email_templates(id) on delete set null;

create index if not exists forms_auto_response_template_id_idx on public.forms (auto_response_template_id);
