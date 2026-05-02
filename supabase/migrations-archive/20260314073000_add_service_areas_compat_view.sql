create or replace view public.service_areas as
select *
from public.areas;

grant select on public.service_areas to anon, authenticated, service_role;
