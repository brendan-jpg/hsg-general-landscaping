create table if not exists public.team_member_employment (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  team_member_id uuid not null unique references public.team_members(id) on delete cascade,
  profile_id uuid unique null references public.profiles(id) on delete set null,
  login_email text,
  login_status text not null default 'not_created'
    check (login_status in ('not_created', 'invited', 'active', 'disabled')),
  app_role public.user_role not null default 'employee',
  employment_status text not null default 'full_time'
    check (employment_status in ('part_time', 'full_time', 'contractor')),
  pay_type text not null default 'hourly'
    check (pay_type in ('hourly', 'salary', 'contract')),
  hourly_rate numeric(10,2),
  salary_amount numeric(12,2),
  start_date date,
  end_date date,
  internal_notes text,
  invited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists team_member_employment_business_id_idx
  on public.team_member_employment (business_id);

create index if not exists team_member_employment_team_member_id_idx
  on public.team_member_employment (team_member_id);

create index if not exists team_member_employment_profile_id_idx
  on public.team_member_employment (profile_id);

alter table public.team_member_employment enable row level security;

grant select on public.team_member_employment to authenticated;
grant insert, update, delete on public.team_member_employment to authenticated;

create policy "team_member_employment_authenticated_read_own_business"
  on public.team_member_employment
  for select
  to authenticated
  using (
    business_id = (
      select p.business_id
      from public.profiles p
      where p.id = auth.uid()
    )
  );

create policy "team_member_employment_authenticated_write_own_business"
  on public.team_member_employment
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
