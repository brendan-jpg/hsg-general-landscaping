alter table public.services
add column if not exists before_after_groups jsonb not null default '[]'::jsonb;

update public.services
set before_after_groups = (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'before_urls',
        case
          when coalesce(before_url, '') = '' then '[]'::jsonb
          else jsonb_build_array(before_url)
        end,
        'after_urls',
        case
          when coalesce(after_url, '') = '' then '[]'::jsonb
          else jsonb_build_array(after_url)
        end
      )
      order by idx
    ),
    '[]'::jsonb
  )
  from (
    select
      gs.idx,
      services.before_gallery_urls[gs.idx] as before_url,
      services.after_gallery_urls[gs.idx] as after_url
    from generate_series(
      1,
      greatest(
        coalesce(array_length(services.before_gallery_urls, 1), 0),
        coalesce(array_length(services.after_gallery_urls, 1), 0)
      )
    ) as gs(idx)
  ) paired
  where coalesce(before_url, '') <> '' or coalesce(after_url, '') <> ''
)
where coalesce(jsonb_array_length(before_after_groups), 0) = 0
  and (
    coalesce(array_length(before_gallery_urls, 1), 0) > 0
    or coalesce(array_length(after_gallery_urls, 1), 0) > 0
  );
