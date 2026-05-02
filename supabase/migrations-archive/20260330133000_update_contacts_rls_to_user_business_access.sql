alter table public.contacts enable row level security;

drop policy if exists "Auth users manage contacts" on public.contacts;
drop policy if exists "contacts_authenticated_read_own_business" on public.contacts;
drop policy if exists "contacts_authenticated_insert_own_business" on public.contacts;
drop policy if exists "contacts_authenticated_update_own_business" on public.contacts;
drop policy if exists "contacts_authenticated_delete_own_business" on public.contacts;

create policy "contacts_authenticated_read_own_business"
  on public.contacts
  for select
  to authenticated
  using (public.current_user_has_business_access(business_id));

create policy "contacts_authenticated_insert_own_business"
  on public.contacts
  for insert
  to authenticated
  with check (public.current_user_has_business_access(business_id));

create policy "contacts_authenticated_update_own_business"
  on public.contacts
  for update
  to authenticated
  using (public.current_user_has_business_access(business_id))
  with check (public.current_user_has_business_access(business_id));

create policy "contacts_authenticated_delete_own_business"
  on public.contacts
  for delete
  to authenticated
  using (public.current_user_has_business_access(business_id));
