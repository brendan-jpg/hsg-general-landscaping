-- Add a canceled job status for operational workflow.

do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'job_status'
  ) then
    alter type public.job_status add value if not exists 'canceled';
  end if;
end $$;
