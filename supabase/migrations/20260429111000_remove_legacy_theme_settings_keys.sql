update public.businesses
set theme_key = case
  when nullif(trim(coalesce(theme_key, '')), '') is not null then theme_key
  when nullif(lower(trim(coalesce(settings->>'frontend_theme', ''))), '') is not null
    and lower(trim(coalesce(settings->>'frontend_theme', ''))) <> 'starter-theme'
    then lower(trim(settings->>'frontend_theme'))
  else 'client-' || slug || '-theme'
end
where nullif(trim(coalesce(theme_key, '')), '') is null;

update public.businesses
set theme_css = nullif(settings->>'frontend_theme_css', '')
where theme_css is null
  and nullif(settings->>'frontend_theme_css', '') is not null;

update public.businesses
set settings = (
  coalesce(settings, '{}'::jsonb)
  - 'frontend_theme'
  - 'frontend_theme_css'
  - 'frontend_theme_css_theme'
)
where coalesce(settings, '{}'::jsonb) ?| array[
  'frontend_theme',
  'frontend_theme_css',
  'frontend_theme_css_theme'
];
