-- Collapse legacy profile roles into two roles:
-- owner/admin -> admin
-- editor/technician -> employee

do $$
begin
  if exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'user_role'
  ) then
    update public.profiles
    set role = case
      when role::text in ('owner', 'admin') then 'admin'::public.user_role
      else 'editor'::public.user_role
    end
    where role::text in ('owner', 'admin', 'editor', 'technician');

    create type public.user_role_new as enum ('admin', 'employee');

    alter table public.profiles
      alter column role drop default;

    alter table public.profiles
      alter column role type public.user_role_new
      using (
        case
          when role::text = 'admin' then 'admin'
          else 'employee'
        end
      )::public.user_role_new;

    drop type public.user_role;
    alter type public.user_role_new rename to user_role;

    alter table public.profiles
      alter column role set default 'employee'::public.user_role;
  end if;
end $$;
