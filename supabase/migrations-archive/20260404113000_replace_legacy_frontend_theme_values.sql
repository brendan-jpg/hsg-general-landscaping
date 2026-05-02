update public.businesses
set settings = jsonb_set(
  coalesce(settings, '{}'::jsonb),
  '{frontend_theme}',
  to_jsonb(
    case lower(trim(coalesce(settings->>'frontend_theme', '')))
      when 'hsg-theme' then 'client-hsg-theme'
      when 'atlas-oxide' then 'starter-theme'
      when 'hsg-default' then 'starter-theme'
      when 'general-landscaping' then 'client-general-landscaping-theme'
      when 'client-general-landscaping' then 'client-general-landscaping-theme'
      when 'magnoli' then 'client-magnoli-home-improvements-theme'
      when 'magnoli-home-improvements' then 'client-magnoli-home-improvements-theme'
      when 'client-magnoli-home-improvements' then 'client-magnoli-home-improvements-theme'
      else settings->>'frontend_theme'
    end
  ),
  true
)
where lower(trim(coalesce(settings->>'frontend_theme', ''))) in (
  'hsg-theme',
  'atlas-oxide',
  'hsg-default',
  'general-landscaping',
  'client-general-landscaping',
  'magnoli',
  'magnoli-home-improvements',
  'client-magnoli-home-improvements'
);
