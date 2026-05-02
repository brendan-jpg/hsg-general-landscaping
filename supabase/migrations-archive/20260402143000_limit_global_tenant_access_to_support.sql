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

delete from public.user_business_access
where user_id in (
  select p.id
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(coalesce(u.email, '')) = 'brendan@hsgrowth.com'
);

insert into public.user_business_access (user_id, business_id, role, is_active)
select
  p.id,
  b.id,
  'admin'::public.user_role,
  true
from public.profiles p
join auth.users u on u.id = p.id
cross join public.businesses b
where lower(coalesce(u.email, '')) = 'support@hsgrowth.com'
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
  where lower(coalesce(u.email, '')) = 'support@hsgrowth.com'
  on conflict (user_id, business_id)
  do update set
    role = 'admin'::public.user_role,
    is_active = true,
    updated_at = now();

  return new;
end;
$$;
