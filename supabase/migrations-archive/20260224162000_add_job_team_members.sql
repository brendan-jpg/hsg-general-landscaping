create table if not exists public.job_team_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  team_member_id uuid not null references public.team_members(id) on delete cascade,
  hours_worked numeric(8,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_team_members_unique_job_member unique (job_id, team_member_id),
  constraint job_team_members_hours_nonnegative check (hours_worked is null or hours_worked >= 0)
);

create index if not exists job_team_members_business_id_idx
  on public.job_team_members (business_id);

create index if not exists job_team_members_job_id_idx
  on public.job_team_members (job_id);

create index if not exists job_team_members_team_member_id_idx
  on public.job_team_members (team_member_id);

update public.jobs
set assigned_team_member_id = assigned_team_member_id
where false;

insert into public.job_team_members (business_id, job_id, team_member_id)
select j.business_id, j.id, j.assigned_team_member_id
from public.jobs j
where j.assigned_team_member_id is not null
on conflict (job_id, team_member_id) do nothing;
