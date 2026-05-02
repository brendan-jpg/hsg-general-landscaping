alter table public.businesses
add column if not exists theme_key text;

update public.businesses
set theme_key = case
  when nullif(lower(trim(coalesce(settings->>'frontend_theme', ''))), '') is not null
    and lower(trim(coalesce(settings->>'frontend_theme', ''))) <> 'starter-theme'
    then lower(trim(settings->>'frontend_theme'))
  else 'client-' || slug || '-theme'
end
where nullif(trim(coalesce(theme_key, '')), '') is null;

alter table public.businesses
alter column theme_key set not null;

create unique index if not exists businesses_theme_key_key
  on public.businesses (theme_key);
