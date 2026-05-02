drop policy if exists "Auth users manage automation_rules" on public.automation_rules;
drop policy if exists "automation_rules_authenticated_read_own_business" on public.automation_rules;
drop policy if exists "automation_rules_authenticated_insert_own_business" on public.automation_rules;
drop policy if exists "automation_rules_authenticated_update_own_business" on public.automation_rules;
drop policy if exists "automation_rules_authenticated_delete_own_business" on public.automation_rules;

create policy "automation_rules_authenticated_read_own_business"
  on public.automation_rules
  for select
  to authenticated
  using (public.current_user_has_business_access(business_id));

create policy "automation_rules_authenticated_insert_own_business"
  on public.automation_rules
  for insert
  to authenticated
  with check (public.current_user_has_business_access(business_id));

create policy "automation_rules_authenticated_update_own_business"
  on public.automation_rules
  for update
  to authenticated
  using (public.current_user_has_business_access(business_id))
  with check (public.current_user_has_business_access(business_id));

create policy "automation_rules_authenticated_delete_own_business"
  on public.automation_rules
  for delete
  to authenticated
  using (public.current_user_has_business_access(business_id));
