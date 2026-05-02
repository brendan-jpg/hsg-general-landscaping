alter table public.businesses
add column if not exists theme_css text;

update public.businesses
set theme_css = nullif(settings->>'frontend_theme_css', '')
where theme_css is null
  and nullif(settings->>'frontend_theme_css', '') is not null;
