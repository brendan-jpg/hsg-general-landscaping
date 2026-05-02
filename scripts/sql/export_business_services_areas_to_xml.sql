-- Export services + areas for one business into the XML format accepted by
-- Dashboard > Settings > Import.
--
-- Usage:
-- 1) Update the target business_id in the params CTE if needed.
-- 2) Run the script in Supabase SQL editor or psql.
-- 3) Copy the `services_batch_xml` result into a file like `services-batch.xml`.
-- 4) Copy the `areas_batch_xml` result into a file like `areas-batch.xml`.
-- 5) In the new site's dashboard, go to /dashboard/settings?tab=import:
--    - import `services-batch.xml` as `services` in `create` mode
--    - import `areas-batch.xml` as `areas` in `create` mode

create or replace function pg_temp.block_to_import_text(block jsonb)
returns text
language sql
immutable
as $$
  select case coalesce(block->>'type', '')
    when 'heading' then
      case
        when nullif(trim(block #>> '{data,text}'), '') is null then null
        else concat(
          'H',
          coalesce(nullif(trim(block #>> '{data,level}'), ''), '2'),
          ': ',
          trim(block #>> '{data,text}')
        )
      end
    when 'paragraph' then
      nullif(trim(block #>> '{data,text}'), '')
    when 'list' then
      (
        select string_agg('- ' || item_text, E'\n' order by ordinality)
        from (
          select ordinality, trim(item) as item_text
          from jsonb_array_elements_text(coalesce(block #> '{data,items}', '[]'::jsonb))
            with ordinality as items(item, ordinality)
        ) list_items
        where item_text <> ''
      )
    when 'quote' then
      concat_ws(
        E'\n',
        case
          when nullif(trim(block #>> '{data,caption}'), '') is null then null
          else 'Quote: ' || trim(block #>> '{data,caption}')
        end,
        nullif(trim(block #>> '{data,text}'), '')
      )
    else null
  end;
$$;

create or replace function pg_temp.export_main_content(content jsonb, fallback_heading text default null)
returns text
language sql
stable
as $$
  with content_section as (
    select section
    from jsonb_array_elements(
      case
        when jsonb_typeof(content) = 'object' then coalesce(content->'sections', '[]'::jsonb)
        else '[]'::jsonb
      end
    ) with ordinality as sections(section, ordinality)
    where coalesce(section->>'slotId', '') = 'content'
    order by ordinality
    limit 1
  ),
  template_text as (
    select trim(both E'\n' from concat_ws(
      E'\n\n',
      case
        when nullif(trim(coalesce(section #>> '{data,heading}', fallback_heading)), '') is null then null
        else 'H2: ' || trim(coalesce(section #>> '{data,heading}', fallback_heading))
      end,
      nullif(trim(section #>> '{data,lede}'), ''),
      nullif(trim(section #>> '{data,body}'), ''),
      (
        select string_agg(block_text, E'\n\n' order by ordinality)
        from (
          select ordinality, pg_temp.block_to_import_text(block) as block_text
          from jsonb_array_elements(coalesce(section #> '{data,blocks}', '[]'::jsonb))
            with ordinality as blocks(block, ordinality)
        ) rendered_blocks
        where block_text is not null and block_text <> ''
      )
    )) as value
    from content_section
  ),
  legacy_block_text as (
    select string_agg(block_text, E'\n\n' order by ordinality) as value
    from (
      select ordinality, pg_temp.block_to_import_text(block) as block_text
      from jsonb_array_elements(
        case
          when jsonb_typeof(content) = 'array' then content
          else '[]'::jsonb
        end
      ) with ordinality as blocks(block, ordinality)
    ) rendered_blocks
    where block_text is not null and block_text <> ''
  )
  select coalesce(
    nullif((select value from template_text), ''),
    nullif((select value from legacy_block_text), ''),
    case
      when nullif(trim(fallback_heading), '') is null then ''
      else 'H2: ' || trim(fallback_heading)
    end
  );
$$;

with params as (
  select '3cbb5d4b-a7f2-4030-a26b-7bab14cf0aaf'::uuid as business_id
),
service_rows as (
  select
    s.id,
    s.title,
    s.slug,
    s.sort_order,
    parent.slug as parent_service_slug,
    s.excerpt,
    s.meta_title,
    s.meta_description,
    pg_temp.export_main_content(s.content::jsonb, s.title) as main_content
  from public.services s
  left join public.services parent on parent.id = s.parent_service_id
  join params p on p.business_id = s.business_id
  order by s.sort_order asc, s.title asc
),
area_rows as (
  select
    a.id,
    a.name as title,
    a.slug,
    a.meta_title,
    a.meta_description,
    pg_temp.export_main_content(a.content::jsonb, a.name) as main_content
  from public.areas a
  join params p on p.business_id = a.business_id
  order by a.name asc
)
select
  'services_preview' as export_name,
  jsonb_pretty(jsonb_agg(to_jsonb(service_rows))) as export_payload
from service_rows

union all

select
  'areas_preview' as export_name,
  jsonb_pretty(jsonb_agg(to_jsonb(area_rows))) as export_payload
from area_rows;

with params as (
  select '3cbb5d4b-a7f2-4030-a26b-7bab14cf0aaf'::uuid as business_id
),
service_rows as (
  select
    s.title,
    s.slug,
    s.sort_order,
    parent.slug as parent_service_slug,
    s.excerpt,
    s.meta_title,
    s.meta_description,
    pg_temp.export_main_content(s.content::jsonb, s.title) as main_content
  from public.services s
  left join public.services parent on parent.id = s.parent_service_id
  join params p on p.business_id = s.business_id
  order by s.sort_order asc, s.title asc
)
select xmlserialize(
  content xmlelement(
    name items,
    xmlagg(
      xmlelement(
        name service,
        xmlforest(
          title as title,
          slug as slug,
          sort_order as sort_order,
          parent_service_slug as parent_service_slug,
          excerpt as excerpt,
          meta_title as meta_title,
          meta_description as meta_description,
          main_content as main_content
        )
      )
      order by sort_order, title
    )
  ) as text
) as services_batch_xml
from service_rows;

with params as (
  select '3cbb5d4b-a7f2-4030-a26b-7bab14cf0aaf'::uuid as business_id
),
area_rows as (
  select
    a.name as title,
    a.slug,
    null::integer as sort_order,
    null::text as excerpt,
    a.meta_title,
    a.meta_description,
    pg_temp.export_main_content(a.content::jsonb, a.name) as main_content
  from public.areas a
  join params p on p.business_id = a.business_id
  order by a.name asc
)
select xmlserialize(
  content xmlelement(
    name items,
    xmlagg(
      xmlelement(
        name area,
        xmlforest(
          title as title,
          slug as slug,
          excerpt as excerpt,
          meta_title as meta_title,
          meta_description as meta_description,
          main_content as main_content
        )
      )
      order by title
    )
  ) as text
) as areas_batch_xml
from area_rows;
