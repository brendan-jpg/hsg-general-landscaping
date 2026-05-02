alter table public.pages
  add column if not exists page_kind text;

update public.pages
set page_kind = case
  when slug = 'home' then 'home'
  when slug = 'services' then 'services_archive'
  when slug in ('service-areas', 'areas') then 'areas_archive'
  when slug = 'about' then 'about'
  when slug = 'blog' then 'blog_archive'
  when slug = 'contact' then 'contact'
  else page_kind
end
where page_kind is null;

alter table public.pages
  drop constraint if exists pages_page_kind_check;

alter table public.pages
  add constraint pages_page_kind_check
  check (page_kind is null or page_kind in ('home', 'services_archive', 'areas_archive', 'about', 'blog_archive', 'contact'));

create unique index if not exists pages_business_id_page_kind_idx
  on public.pages (business_id, page_kind)
  where page_kind is not null;
