-- Recreate General Landscaping Areas after accidental deletion.
-- Creates Area pages and re-links them to all active services for the business.

do $$
declare
  v_business_id uuid;
  v_business_name text;
  v_business_count integer;
  v_row record;
begin
  select count(*) into v_business_count from public.businesses;

  select b.id, coalesce(b.name, 'General Landscaping')
  into v_business_id, v_business_name
  from public.businesses b
  where lower(coalesce(b.slug, '')) like '%general-landscaping%'
     or lower(coalesce(b.name, '')) like '%general landscaping%'
  order by b.created_at asc
  limit 1;

  if v_business_id is null and v_business_count = 1 then
    select id, coalesce(name, 'General Landscaping')
    into v_business_id, v_business_name
    from public.businesses
    order by created_at asc
    limit 1;

    raise notice 'General Landscaping business not found by slug/name. Using the only business in the database: %', v_business_id;
  end if;

  if v_business_id is null then
    raise exception 'Unable to identify target business for Area reseed.';
  end if;

  for v_row in
    select *
    from (
      values
        ('Portland', 'portland'),
        ('Colchester', 'colchester'),
        ('East Hampton', 'east-hampton'),
        ('Marlborough', 'marlborough'),
        ('Hebron', 'hebron'),
        ('Manchester', 'manchester'),
        ('Glastonbury', 'glastonbury')
    ) as areas(name, slug)
  loop
    update public.service_areas
    set
      name = v_row.name,
      is_active = true,
      featured_image_url = null,
      meta_title = v_business_name || ' in ' || v_row.name || ', CT',
      meta_description = 'Area page for ' || v_row.name || ', CT with local service information, process details, and related content.',
      content = jsonb_build_object(
        'kind', 'template-page',
        'version', 1,
        'templateKey', 'area-content-v1',
        'sections', jsonb_build_array(
          jsonb_build_object('id', 'hero', 'slotId', 'hero', 'type', 'layout_marker', 'hidden', false, 'data', jsonb_build_object()),
          jsonb_build_object('id', 'intro', 'slotId', 'intro', 'type', 'layout_marker', 'hidden', false, 'data', jsonb_build_object()),
          jsonb_build_object(
            'id', 'content',
            'slotId', 'content',
            'type', 'long_form_body_section',
            'hidden', false,
            'data', jsonb_build_object(
              'blocks',
              jsonb_build_array(
                jsonb_build_object(
                  'type', 'heading',
                  'data', jsonb_build_object('text', 'Outdoor Services in ' || v_row.name || ', CT', 'level', 2)
                ),
                jsonb_build_object(
                  'type', 'paragraph',
                  'data', jsonb_build_object(
                    'text',
                    v_business_name || ' provides landscaping and outdoor improvement services for homeowners in ' || v_row.name || ', Connecticut. We use this page to outline how we work in this area, what local homeowners usually ask for, and how we approach projects with clear communication and dependable scheduling.'
                  )
                ),
                jsonb_build_object(
                  'type', 'paragraph',
                  'data', jsonb_build_object(
                    'text',
                    'Every property is different, so our recommendations are based on the condition of the space, drainage and access considerations, and the homeowner''s goals for maintenance and long-term use. Whether the project is a repair, cleanup, installation, or a larger outdoor upgrade, we focus on practical planning and clean execution.'
                  )
                ),
                jsonb_build_object(
                  'type', 'heading',
                  'data', jsonb_build_object('text', 'What homeowners in ' || v_row.name || ' typically need', 'level', 3)
                ),
                jsonb_build_object(
                  'type', 'list',
                  'data', jsonb_build_object(
                    'ordered', false,
                    'items', jsonb_build_array(
                      'Seasonal cleanup and property refresh work',
                      'Landscape improvements that fit the home and lot layout',
                      'Drainage-aware planning for problem areas',
                      'Repairs or upgrades to improve curb appeal and usability',
                      'Clear project scopes, scheduling, and follow-through'
                    )
                  )
                ),
                jsonb_build_object(
                  'type', 'paragraph',
                  'data', jsonb_build_object(
                    'text',
                    'This Area page works alongside our specific service pages. The detailed service pages explain the work itself, while this page is focused on how we support homeowners in ' || v_row.name || ' and what they can expect from the overall process.'
                  )
                )
              )
            )
          ),
          jsonb_build_object('id', 'process', 'slotId', 'process', 'type', 'layout_marker', 'hidden', false, 'data', jsonb_build_object()),
          jsonb_build_object('id', 'related_reviews', 'slotId', 'related_reviews', 'type', 'layout_marker', 'hidden', false, 'data', jsonb_build_object()),
          jsonb_build_object('id', 'related_faqs', 'slotId', 'related_faqs', 'type', 'layout_marker', 'hidden', false, 'data', jsonb_build_object()),
          jsonb_build_object('id', 'related_articles', 'slotId', 'related_articles', 'type', 'layout_marker', 'hidden', false, 'data', jsonb_build_object()),
          jsonb_build_object('id', 'area_projects', 'slotId', 'area_projects', 'type', 'layout_marker', 'hidden', false, 'data', jsonb_build_object()),
          jsonb_build_object('id', 'gallery', 'slotId', 'gallery', 'type', 'layout_marker', 'hidden', false, 'data', jsonb_build_object()),
          jsonb_build_object('id', 'before_after', 'slotId', 'before_after', 'type', 'layout_marker', 'hidden', false, 'data', jsonb_build_object()),
          jsonb_build_object('id', 'related_services', 'slotId', 'related_services', 'type', 'layout_marker', 'hidden', false, 'data', jsonb_build_object())
        )
      )::json,
      updated_at = now()
    where business_id = v_business_id
      and slug = v_row.slug;

    if not found then
      insert into public.service_areas (
        business_id,
        name,
        slug,
        is_active,
        featured_image_url,
        meta_title,
        meta_description,
        content
      )
      values (
        v_business_id,
        v_row.name,
        v_row.slug,
        true,
        null,
        v_business_name || ' in ' || v_row.name || ', CT',
        'Area page for ' || v_row.name || ', CT with local service information, process details, and related content.',
        jsonb_build_object(
          'kind', 'template-page',
          'version', 1,
          'templateKey', 'area-content-v1',
          'sections', jsonb_build_array(
            jsonb_build_object('id', 'hero', 'slotId', 'hero', 'type', 'layout_marker', 'hidden', false, 'data', jsonb_build_object()),
            jsonb_build_object('id', 'intro', 'slotId', 'intro', 'type', 'layout_marker', 'hidden', false, 'data', jsonb_build_object()),
            jsonb_build_object(
              'id', 'content',
              'slotId', 'content',
              'type', 'long_form_body_section',
              'hidden', false,
              'data', jsonb_build_object(
                'blocks',
                jsonb_build_array(
                  jsonb_build_object(
                    'type', 'heading',
                    'data', jsonb_build_object('text', 'Outdoor Services in ' || v_row.name || ', CT', 'level', 2)
                  ),
                  jsonb_build_object(
                    'type', 'paragraph',
                    'data', jsonb_build_object(
                      'text',
                      v_business_name || ' provides landscaping and outdoor improvement services for homeowners in ' || v_row.name || ', Connecticut. We use this page to outline how we work in this area, what local homeowners usually ask for, and how we approach projects with clear communication and dependable scheduling.'
                    )
                  ),
                  jsonb_build_object(
                    'type', 'paragraph',
                    'data', jsonb_build_object(
                      'text',
                      'Every property is different, so our recommendations are based on the condition of the space, drainage and access considerations, and the homeowner''s goals for maintenance and long-term use. Whether the project is a repair, cleanup, installation, or a larger outdoor upgrade, we focus on practical planning and clean execution.'
                    )
                  ),
                  jsonb_build_object(
                    'type', 'heading',
                    'data', jsonb_build_object('text', 'What homeowners in ' || v_row.name || ' typically need', 'level', 3)
                  ),
                  jsonb_build_object(
                    'type', 'list',
                    'data', jsonb_build_object(
                      'ordered', false,
                      'items', jsonb_build_array(
                        'Seasonal cleanup and property refresh work',
                        'Landscape improvements that fit the home and lot layout',
                        'Drainage-aware planning for problem areas',
                        'Repairs or upgrades to improve curb appeal and usability',
                        'Clear project scopes, scheduling, and follow-through'
                      )
                    )
                  ),
                  jsonb_build_object(
                    'type', 'paragraph',
                    'data', jsonb_build_object(
                      'text',
                      'This Area page works alongside our specific service pages. The detailed service pages explain the work itself, while this page is focused on how we support homeowners in ' || v_row.name || ' and what they can expect from the overall process.'
                    )
                  )
                )
              )
            ),
            jsonb_build_object('id', 'process', 'slotId', 'process', 'type', 'layout_marker', 'hidden', false, 'data', jsonb_build_object()),
            jsonb_build_object('id', 'related_reviews', 'slotId', 'related_reviews', 'type', 'layout_marker', 'hidden', false, 'data', jsonb_build_object()),
            jsonb_build_object('id', 'related_faqs', 'slotId', 'related_faqs', 'type', 'layout_marker', 'hidden', false, 'data', jsonb_build_object()),
            jsonb_build_object('id', 'related_articles', 'slotId', 'related_articles', 'type', 'layout_marker', 'hidden', false, 'data', jsonb_build_object()),
            jsonb_build_object('id', 'area_projects', 'slotId', 'area_projects', 'type', 'layout_marker', 'hidden', false, 'data', jsonb_build_object()),
            jsonb_build_object('id', 'gallery', 'slotId', 'gallery', 'type', 'layout_marker', 'hidden', false, 'data', jsonb_build_object()),
            jsonb_build_object('id', 'before_after', 'slotId', 'before_after', 'type', 'layout_marker', 'hidden', false, 'data', jsonb_build_object()),
            jsonb_build_object('id', 'related_services', 'slotId', 'related_services', 'type', 'layout_marker', 'hidden', false, 'data', jsonb_build_object())
          )
        )::json
      );
    end if;
  end loop;

  -- Link every active service to every recreated Area (idempotent).
  insert into public.service_area_services (
    service_area_id,
    service_id,
    slug,
    is_active,
    meta_title,
    meta_description
  )
  select
    a.id,
    s.id,
    s.slug || '-in-' || a.slug,
    true,
    s.title || ' in ' || a.name || ', CT | ' || v_business_name,
    v_business_name || ' offers ' || lower(s.title) || ' in ' || a.name || ', CT.'
  from public.service_areas a
  join public.services s
    on s.business_id = a.business_id
  where a.business_id = v_business_id
    and a.slug in ('portland', 'colchester', 'east-hampton', 'marlborough', 'hebron', 'manchester', 'glastonbury')
    and coalesce(s.is_active, true) = true
    and not exists (
      select 1
      from public.service_area_services sas
      where sas.service_area_id = a.id
        and sas.service_id = s.id
    );
end $$;
