do $$
begin
  if to_regclass('public.areas') is null and to_regclass('public.service_areas') is not null then
    alter table public.service_areas rename to areas;
  end if;

  if to_regclass('public.area_services') is null and to_regclass('public.service_area_services') is not null then
    alter table public.service_area_services rename to area_services;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'area_services'
      and column_name = 'service_area_id'
  ) then
    alter table public.area_services rename column service_area_id to area_id;
  end if;
end
$$;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'service_areas_business_id_fkey') then
    alter table public.areas rename constraint service_areas_business_id_fkey to areas_business_id_fkey;
  end if;

  if exists (select 1 from pg_constraint where conname = 'service_area_services_service_area_id_fkey') then
    alter table public.area_services rename constraint service_area_services_service_area_id_fkey to area_services_area_id_fkey;
  end if;

  if exists (select 1 from pg_constraint where conname = 'service_area_services_service_id_fkey') then
    alter table public.area_services rename constraint service_area_services_service_id_fkey to area_services_service_id_fkey;
  end if;
end
$$;

alter index if exists public.service_areas_pkey rename to areas_pkey;
alter index if exists public.service_area_services_pkey rename to area_services_pkey;

update public.businesses
set settings = (
  replace(
    replace(
      replace(
        replace(settings::text,
          '"service_area_default_title_template":',
          '"area_default_title_template":'
        ),
        '"service_area_default_h1_template":',
        '"area_default_h1_template":'
      ),
      '"service_area_default_url_template":',
      '"area_default_url_template":'
    ),
    '"childrenSource":"service_areas"',
    '"childrenSource":"areas"'
  )::jsonb
)
where settings is not null
  and settings::text ~ 'service_area_default_|"childrenSource":"service_areas"';

update public.services
set service_projects = (
  select coalesce(
    jsonb_agg(
      case
        when jsonb_typeof(item) = 'object' and item ? 'service_area_ids'
          then (item - 'service_area_ids') || jsonb_build_object('area_ids', item->'service_area_ids')
        else item
      end
    ),
    '[]'::jsonb
  )
  from jsonb_array_elements(coalesce(service_projects, '[]'::jsonb)) as item
)
where jsonb_typeof(coalesce(service_projects, '[]'::jsonb)) = 'array';
