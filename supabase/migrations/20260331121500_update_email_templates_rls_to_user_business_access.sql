drop policy if exists "Auth users manage email_templates" on public.email_templates;
drop policy if exists "email_templates_authenticated_read_own_business" on public.email_templates;
drop policy if exists "email_templates_authenticated_insert_own_business" on public.email_templates;
drop policy if exists "email_templates_authenticated_update_own_business" on public.email_templates;
drop policy if exists "email_templates_authenticated_delete_own_business" on public.email_templates;

create policy "email_templates_authenticated_read_own_business"
  on public.email_templates
  for select
  to authenticated
  using (public.current_user_has_business_access(business_id));

create policy "email_templates_authenticated_insert_own_business"
  on public.email_templates
  for insert
  to authenticated
  with check (public.current_user_has_business_access(business_id));

create policy "email_templates_authenticated_update_own_business"
  on public.email_templates
  for update
  to authenticated
  using (public.current_user_has_business_access(business_id))
  with check (public.current_user_has_business_access(business_id));

create policy "email_templates_authenticated_delete_own_business"
  on public.email_templates
  for delete
  to authenticated
  using (public.current_user_has_business_access(business_id));
