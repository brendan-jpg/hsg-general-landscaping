alter table public.jobs
  add column if not exists assigned_team_member_id uuid null references public.team_members(id) on delete set null;

alter table public.schedule_items
  add column if not exists assigned_team_member_id uuid null references public.team_members(id) on delete set null;

create index if not exists jobs_assigned_team_member_id_idx
  on public.jobs (assigned_team_member_id);

create index if not exists schedule_items_assigned_team_member_id_idx
  on public.schedule_items (assigned_team_member_id, starts_at asc);

update public.jobs j
set assigned_team_member_id = tme.team_member_id
from public.team_member_employment tme
where j.assigned_to is not null
  and tme.profile_id = j.assigned_to
  and tme.business_id = j.business_id
  and j.assigned_team_member_id is null;

update public.schedule_items si
set assigned_team_member_id = tme.team_member_id
from public.team_member_employment tme
where si.assigned_to is not null
  and tme.profile_id = si.assigned_to
  and tme.business_id = si.business_id
  and si.assigned_team_member_id is null;
