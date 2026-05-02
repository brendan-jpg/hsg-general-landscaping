do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'services'
      and column_name = 'before_after_gallery_urls'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'services'
      and column_name = 'before_gallery_urls'
  ) then
    alter table public.services
      rename column before_after_gallery_urls to before_gallery_urls;
  end if;
end $$;
