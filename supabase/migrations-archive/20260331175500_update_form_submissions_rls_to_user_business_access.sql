alter table public.form_submissions enable row level security;

drop policy if exists "Auth users manage form_submissions" on public.form_submissions;
drop policy if exists "form_submissions_authenticated_read_own_business" on public.form_submissions;
drop policy if exists "form_submissions_authenticated_insert_own_business" on public.form_submissions;
drop policy if exists "form_submissions_authenticated_update_own_business" on public.form_submissions;
drop policy if exists "form_submissions_authenticated_delete_own_business" on public.form_submissions;

create policy "form_submissions_authenticated_read_own_business"
  on public.form_submissions
  for select
  to authenticated
  using (public.current_user_has_business_access(business_id));

create policy "form_submissions_authenticated_insert_own_business"
  on public.form_submissions
  for insert
  to authenticated
  with check (public.current_user_has_business_access(business_id));

create policy "form_submissions_authenticated_update_own_business"
  on public.form_submissions
  for update
  to authenticated
  using (public.current_user_has_business_access(business_id))
  with check (public.current_user_has_business_access(business_id));

create policy "form_submissions_authenticated_delete_own_business"
  on public.form_submissions
  for delete
  to authenticated
  using (public.current_user_has_business_access(business_id));
