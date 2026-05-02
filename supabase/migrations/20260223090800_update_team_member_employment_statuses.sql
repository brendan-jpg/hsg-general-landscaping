alter table public.team_member_employment
  alter column employment_status set default 'full_time';

update public.team_member_employment
set employment_status = case employment_status
  when 'active' then 'full_time'
  when 'inactive' then 'part_time'
  when 'on_leave' then 'part_time'
  when 'terminated' then 'part_time'
  else employment_status
end
where employment_status in ('active', 'inactive', 'on_leave', 'terminated');

update public.team_member_employment
set employment_status = 'full_time'
where employment_status is null
   or employment_status not in ('part_time', 'full_time', 'contractor');

alter table public.team_member_employment
  drop constraint if exists team_member_employment_employment_status_check;

alter table public.team_member_employment
  add constraint team_member_employment_employment_status_check
  check (employment_status in ('part_time', 'full_time', 'contractor'));
