-- Optional parent/child hierarchy for services.
-- parent_service_id is nullable and self-references services.id.

alter table public.services
  add column if not exists parent_service_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'services_parent_service_id_fkey'
  ) then
    alter table public.services
      add constraint services_parent_service_id_fkey
      foreign key (parent_service_id)
      references public.services(id)
      on delete set null;
  end if;
end $$;

create index if not exists services_parent_service_id_idx
  on public.services(parent_service_id);
