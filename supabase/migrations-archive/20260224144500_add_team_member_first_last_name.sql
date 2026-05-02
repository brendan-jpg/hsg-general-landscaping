alter table public.team_members
  add column if not exists first_name text null,
  add column if not exists last_name text null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'team_members'
      and column_name = 'name'
  ) then
    execute $sql$
      update public.team_members
      set
        first_name = nullif(split_part(trim(name), ' ', 1), ''),
        last_name = nullif(
          trim(
            case
              when strpos(trim(name), ' ') > 0
                then substr(trim(name), strpos(trim(name), ' ') + 1)
              else ''
            end
          ),
          ''
        )
      where (first_name is null and last_name is null)
        and coalesce(trim(name), '') <> ''
    $sql$;
  end if;
end $$;
