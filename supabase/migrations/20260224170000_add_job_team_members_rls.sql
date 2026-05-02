alter table public.job_team_members enable row level security;

grant select, insert, update, delete on public.job_team_members to authenticated;

drop policy if exists "job_team_members_authenticated_read_own_business" on public.job_team_members;
create policy "job_team_members_authenticated_read_own_business"
  on public.job_team_members
  for select
  to authenticated
  using (
    business_id = (
      select p.business_id
      from public.profiles p
      where p.id = auth.uid()
    )
  );

drop policy if exists "job_team_members_authenticated_write_own_business" on public.job_team_members;
create policy "job_team_members_authenticated_write_own_business"
  on public.job_team_members
  for all
  to authenticated
  using (
    business_id = (
      select p.business_id
      from public.profiles p
      where p.id = auth.uid()
    )
  )
  with check (
    business_id = (
      select p.business_id
      from public.profiles p
      where p.id = auth.uid()
    )
  );
