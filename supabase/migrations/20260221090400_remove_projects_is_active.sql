alter table public.projects
  drop column if exists is_active;

drop index if exists projects_active_date_idx;
create index if not exists projects_active_date_idx
  on public.projects (business_id, project_date desc, created_at desc);
