alter table public.services
  drop column if exists before_gallery_urls,
  drop column if exists after_gallery_urls,
  drop column if exists before_after_gallery_urls;
