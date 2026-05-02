alter table public.testimonials
add column if not exists area_id uuid references public.areas(id) on delete set null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'testimonials'
      and column_name = 'customer_location'
  ) then
    update public.testimonials as t
    set area_id = a.id
    from public.areas as a
    where t.area_id is null
      and t.customer_location is not null
      and a.business_id = t.business_id
      and a.name = t.customer_location;
  end if;
end $$;

alter table public.testimonials
drop column if exists customer_location;
