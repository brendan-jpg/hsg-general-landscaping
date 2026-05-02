-- Set default icon values across existing services and Areas.
-- Uses a preset icon key for Areas and a public asset path for services.

update public.service_areas
set icon = 'pin'
where coalesce(nullif(trim(icon), ''), '') <> 'pin';

update public.services
set icon = '/gl-icon-dark.svg'
where coalesce(nullif(trim(icon), ''), '') <> '/gl-icon-dark.svg';
