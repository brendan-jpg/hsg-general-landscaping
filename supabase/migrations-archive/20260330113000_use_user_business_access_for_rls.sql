create or replace function public.current_user_has_business_access(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_business_access uba
    where uba.user_id = auth.uid()
      and uba.business_id = target_business_id
      and uba.is_active = true
  );
$$;

grant execute on function public.current_user_has_business_access(uuid) to authenticated;

insert into public.user_business_access (user_id, business_id, role, is_active)
select
  p.id,
  b.id,
  'admin'::public.user_role,
  true
from public.profiles p
join auth.users u on u.id = p.id
cross join public.businesses b
where lower(coalesce(u.email, '')) in ('support@hsgrowth.com', 'brendan@hsgrowth.com')
on conflict (user_id, business_id)
do update set
  role = 'admin'::public.user_role,
  is_active = true,
  updated_at = now();

create or replace function public.grant_platform_admin_access_for_new_business()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_business_access (user_id, business_id, role, is_active)
  select
    p.id,
    new.id,
    'admin'::public.user_role,
    true
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(coalesce(u.email, '')) in ('support@hsgrowth.com', 'brendan@hsgrowth.com')
  on conflict (user_id, business_id)
  do update set
    role = 'admin'::public.user_role,
    is_active = true,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists grant_platform_admin_access_for_new_business on public.businesses;
create trigger grant_platform_admin_access_for_new_business
after insert on public.businesses
for each row execute function public.grant_platform_admin_access_for_new_business();

drop policy if exists "team_members_authenticated_insert_own_business" on public.team_members;
create policy "team_members_authenticated_insert_own_business"
  on public.team_members
  for insert
  to authenticated
  with check (public.current_user_has_business_access(business_id));

drop policy if exists "team_members_authenticated_update_own_business" on public.team_members;
create policy "team_members_authenticated_update_own_business"
  on public.team_members
  for update
  to authenticated
  using (public.current_user_has_business_access(business_id))
  with check (public.current_user_has_business_access(business_id));

drop policy if exists "team_members_authenticated_delete_own_business" on public.team_members;
create policy "team_members_authenticated_delete_own_business"
  on public.team_members
  for delete
  to authenticated
  using (public.current_user_has_business_access(business_id));

drop policy if exists "projects_authenticated_insert_own_business" on public.projects;
create policy "projects_authenticated_insert_own_business"
  on public.projects
  for insert
  to authenticated
  with check (public.current_user_has_business_access(business_id));

drop policy if exists "projects_authenticated_update_own_business" on public.projects;
create policy "projects_authenticated_update_own_business"
  on public.projects
  for update
  to authenticated
  using (public.current_user_has_business_access(business_id))
  with check (public.current_user_has_business_access(business_id));

drop policy if exists "projects_authenticated_delete_own_business" on public.projects;
create policy "projects_authenticated_delete_own_business"
  on public.projects
  for delete
  to authenticated
  using (public.current_user_has_business_access(business_id));

drop policy if exists "project_services_authenticated_write_own_business" on public.project_services;
create policy "project_services_authenticated_write_own_business"
  on public.project_services
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.projects pr
      join public.services s on s.id = project_services.service_id and s.business_id = pr.business_id
      where pr.id = project_services.project_id
        and public.current_user_has_business_access(pr.business_id)
    )
  )
  with check (
    exists (
      select 1
      from public.projects pr
      join public.services s on s.id = project_services.service_id and s.business_id = pr.business_id
      where pr.id = project_services.project_id
        and public.current_user_has_business_access(pr.business_id)
    )
  );

drop policy if exists "faq_services_authenticated_write_own_business" on public.faq_services;
create policy "faq_services_authenticated_write_own_business"
  on public.faq_services
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.faqs f
      join public.services s on s.id = faq_services.service_id and s.business_id = f.business_id
      where f.id = faq_services.faq_id
        and public.current_user_has_business_access(f.business_id)
    )
  )
  with check (
    exists (
      select 1
      from public.faqs f
      join public.services s on s.id = faq_services.service_id and s.business_id = f.business_id
      where f.id = faq_services.faq_id
        and public.current_user_has_business_access(f.business_id)
    )
  );

drop policy if exists "schedule_items_authenticated_read_own_business" on public.schedule_items;
create policy "schedule_items_authenticated_read_own_business"
  on public.schedule_items
  for select
  to authenticated
  using (public.current_user_has_business_access(business_id));

drop policy if exists "schedule_items_authenticated_write_own_business" on public.schedule_items;
create policy "schedule_items_authenticated_write_own_business"
  on public.schedule_items
  for all
  to authenticated
  using (public.current_user_has_business_access(business_id))
  with check (public.current_user_has_business_access(business_id));

drop policy if exists "team_member_employment_authenticated_read_own_business" on public.team_member_employment;
create policy "team_member_employment_authenticated_read_own_business"
  on public.team_member_employment
  for select
  to authenticated
  using (public.current_user_has_business_access(business_id));

drop policy if exists "team_member_employment_authenticated_write_own_business" on public.team_member_employment;
create policy "team_member_employment_authenticated_write_own_business"
  on public.team_member_employment
  for all
  to authenticated
  using (public.current_user_has_business_access(business_id))
  with check (public.current_user_has_business_access(business_id));

drop policy if exists "blog_post_services_authenticated_write_own_business" on public.blog_post_services;
create policy "blog_post_services_authenticated_write_own_business"
  on public.blog_post_services
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.blog_posts bp
      join public.services s on s.id = blog_post_services.service_id and s.business_id = bp.business_id
      where bp.id = blog_post_services.blog_post_id
        and public.current_user_has_business_access(bp.business_id)
    )
  )
  with check (
    exists (
      select 1
      from public.blog_posts bp
      join public.services s on s.id = blog_post_services.service_id and s.business_id = bp.business_id
      where bp.id = blog_post_services.blog_post_id
        and public.current_user_has_business_access(bp.business_id)
    )
  );

drop policy if exists "quickbooks_connections_authenticated_own_business" on public.quickbooks_connections;
create policy "quickbooks_connections_authenticated_own_business"
  on public.quickbooks_connections
  for all
  to authenticated
  using (public.current_user_has_business_access(business_id))
  with check (public.current_user_has_business_access(business_id));

drop policy if exists "job_team_members_authenticated_read_own_business" on public.job_team_members;
create policy "job_team_members_authenticated_read_own_business"
  on public.job_team_members
  for select
  to authenticated
  using (public.current_user_has_business_access(business_id));

drop policy if exists "job_team_members_authenticated_write_own_business" on public.job_team_members;
create policy "job_team_members_authenticated_write_own_business"
  on public.job_team_members
  for all
  to authenticated
  using (public.current_user_has_business_access(business_id))
  with check (public.current_user_has_business_access(business_id));

drop policy if exists "forms_authenticated_read_own_business" on public.forms;
create policy "forms_authenticated_read_own_business"
  on public.forms
  for select
  to authenticated
  using (public.current_user_has_business_access(business_id));

drop policy if exists "forms_authenticated_insert_own_business" on public.forms;
create policy "forms_authenticated_insert_own_business"
  on public.forms
  for insert
  to authenticated
  with check (public.current_user_has_business_access(business_id));

drop policy if exists "forms_authenticated_update_own_business" on public.forms;
create policy "forms_authenticated_update_own_business"
  on public.forms
  for update
  to authenticated
  using (public.current_user_has_business_access(business_id))
  with check (public.current_user_has_business_access(business_id));

drop policy if exists "forms_authenticated_delete_own_business" on public.forms;
create policy "forms_authenticated_delete_own_business"
  on public.forms
  for delete
  to authenticated
  using (public.current_user_has_business_access(business_id));

drop policy if exists "estimate_approvals_authenticated_read_own_business" on public.estimate_approvals;
create policy "estimate_approvals_authenticated_read_own_business"
  on public.estimate_approvals
  for select
  to authenticated
  using (public.current_user_has_business_access(business_id));
