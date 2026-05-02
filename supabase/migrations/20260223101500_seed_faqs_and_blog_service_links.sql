-- Seed FAQ content and service links, plus additional blog content and blog-service links.
-- Idempotent by business + question/slug checks so it can be re-run safely.

do $$
declare
  v_business_id uuid;
  v_business_count integer;
begin
  select count(*) into v_business_count from public.businesses;

  select b.id
  into v_business_id
  from public.businesses b
  where lower(b.slug) = 'summit-roofing'
     or lower(b.name) = 'summit roofing'
  order by b.created_at asc
  limit 1;

  if v_business_id is null and v_business_count = 1 then
    select id into v_business_id from public.businesses order by created_at asc limit 1;
    raise notice 'Summit Roofing business not found by slug/name. Using the only business in the database: %', v_business_id;
  end if;

  if v_business_id is null then
    raise exception 'Unable to identify target business for FAQ/blog seed content. Expected a business with slug/name "summit-roofing"/"Summit Roofing".';
  end if;

  -- FAQs (service-linked)
  insert into public.faqs (
    business_id,
    question,
    answer,
    sort_order,
    is_global,
    schema_markup,
    page_type,
    page_id
  )
  select
    v_business_id,
    'How do I know if I need a roof repair or a full replacement?',
    'The decision usually comes down to roof age, how widespread the damage is, and how often you have already repaired it. If the problem is isolated and the roof still has good life left, a repair is often the best value. If damage is recurring across multiple areas or the roof is near the end of its lifespan, replacement is usually the smarter long-term investment.',
    10,
    false,
    true,
    null,
    null
  where not exists (
    select 1 from public.faqs f
    where f.business_id = v_business_id
      and f.question = 'How do I know if I need a roof repair or a full replacement?'
  );

  insert into public.faqs (business_id, question, answer, sort_order, is_global, schema_markup, page_type, page_id)
  select
    v_business_id,
    'How long does a typical roof replacement take?',
    'Most residential roof replacements are completed in one to three days, depending on roof size, material type, weather, and whether hidden decking damage is discovered during tear-off. We provide a timeline before the project starts and update you if weather or field conditions change the schedule.',
    20,
    false,
    true,
    null,
    null
  where not exists (
    select 1 from public.faqs f
    where f.business_id = v_business_id
      and f.question = 'How long does a typical roof replacement take?'
  );

  insert into public.faqs (business_id, question, answer, sort_order, is_global, schema_markup, page_type, page_id)
  select
    v_business_id,
    'What should I do right after a hail or wind storm?',
    'Start by documenting visible damage from the ground with photos, check interior ceilings and attic spaces for water stains, and avoid getting on the roof. Then schedule a storm damage inspection so the roof condition can be documented and repair or replacement needs can be assessed safely.',
    30,
    false,
    true,
    null,
    null
  where not exists (
    select 1 from public.faqs f
    where f.business_id = v_business_id
      and f.question = 'What should I do right after a hail or wind storm?'
  );

  insert into public.faqs (business_id, question, answer, sort_order, is_global, schema_markup, page_type, page_id)
  select
    v_business_id,
    'Can storm damage exist even if my roof looks fine from the ground?',
    'Yes. Hail and wind damage can affect shingles, flashing, seal strips, and roof penetrations without being obvious from street level. A professional inspection can identify less visible damage, document roof condition, and help you decide whether repairs are needed now or if the roof should simply be monitored.',
    40,
    false,
    true,
    null,
    null
  where not exists (
    select 1 from public.faqs f
    where f.business_id = v_business_id
      and f.question = 'Can storm damage exist even if my roof looks fine from the ground?'
  );

  insert into public.faqs (business_id, question, answer, sort_order, is_global, schema_markup, page_type, page_id)
  select
    v_business_id,
    'Do I need to replace gutters when I replace my roof?',
    'Not always. Gutters can sometimes stay in place if they are properly sized, draining well, and in good condition. However, roof replacement is a good time to evaluate gutter performance because drainage issues, sagging sections, or poor downspout placement can contribute to roof-edge and fascia problems.',
    50,
    false,
    true,
    null,
    null
  where not exists (
    select 1 from public.faqs f
    where f.business_id = v_business_id
      and f.question = 'Do I need to replace gutters when I replace my roof?'
  );

  insert into public.faqs (business_id, question, answer, sort_order, is_global, schema_markup, page_type, page_id)
  select
    v_business_id,
    'How often should I schedule roof maintenance?',
    'For most homes, an annual maintenance visit is a good baseline, plus an additional inspection after major storms. Homes with older roofs, heavy tree coverage, or known drainage trouble spots may benefit from seasonal checkups to catch wear earlier.',
    60,
    false,
    true,
    null,
    null
  where not exists (
    select 1 from public.faqs f
    where f.business_id = v_business_id
      and f.question = 'How often should I schedule roof maintenance?'
  );

  insert into public.faqs (business_id, question, answer, sort_order, is_global, schema_markup, page_type, page_id)
  select
    v_business_id,
    'Can you fix a roof leak quickly, or do I need a full inspection first?',
    'We can often address urgent leak issues quickly, but a full inspection is still important to identify the root cause and nearby weak points. Fast containment helps reduce damage, and a proper inspection helps prevent repeat leaks from the same underlying issue.',
    70,
    false,
    true,
    null,
    null
  where not exists (
    select 1 from public.faqs f
    where f.business_id = v_business_id
      and f.question = 'Can you fix a roof leak quickly, or do I need a full inspection first?'
  );

  insert into public.faqs (business_id, question, answer, sort_order, is_global, schema_markup, page_type, page_id)
  select
    v_business_id,
    'What are the signs my gutters are not draining correctly?',
    'Common signs include water spilling over the gutter edge, sagging sections, leaks at seams, staining on siding, and pooling water near the foundation. These issues often point to slope problems, clogs, undersized sections, or poor downspout placement.',
    80,
    false,
    true,
    null,
    null
  where not exists (
    select 1 from public.faqs f
    where f.business_id = v_business_id
      and f.question = 'What are the signs my gutters are not draining correctly?'
  );

  insert into public.faqs (business_id, question, answer, sort_order, is_global, schema_markup, page_type, page_id)
  select
    v_business_id,
    'Do you provide written estimates and clear scope details before work starts?',
    'Yes. We provide written estimates that outline the scope, recommended work, and pricing details so you can compare options and understand what is included before scheduling. If hidden conditions are found later, we explain them and review any change in scope before proceeding.',
    90,
    true,
    true,
    null,
    null
  where not exists (
    select 1 from public.faqs f
    where f.business_id = v_business_id
      and f.question = 'Do you provide written estimates and clear scope details before work starts?'
  );

  -- FAQ -> Service links
  insert into public.faq_services (faq_id, service_id)
  select f.id, s.id
  from public.faqs f
  join public.services s on s.business_id = f.business_id
  where f.business_id = v_business_id
    and (
      (f.question = 'How do I know if I need a roof repair or a full replacement?' and s.slug in ('roof-repair', 'roof-replacement')) or
      (f.question = 'How long does a typical roof replacement take?' and s.slug in ('roof-replacement')) or
      (f.question = 'What should I do right after a hail or wind storm?' and s.slug in ('storm-damage-inspection', 'roof-repair')) or
      (f.question = 'Can storm damage exist even if my roof looks fine from the ground?' and s.slug in ('storm-damage-inspection')) or
      (f.question = 'Do I need to replace gutters when I replace my roof?' and s.slug in ('gutter-installation', 'roof-replacement')) or
      (f.question = 'How often should I schedule roof maintenance?' and s.slug in ('roof-maintenance')) or
      (f.question = 'Can you fix a roof leak quickly, or do I need a full inspection first?' and s.slug in ('roof-repair', 'storm-damage-inspection')) or
      (f.question = 'What are the signs my gutters are not draining correctly?' and s.slug in ('gutter-installation', 'roof-maintenance')) or
      (f.question = 'Do you provide written estimates and clear scope details before work starts?' and s.slug in ('roof-repair', 'roof-replacement', 'gutter-installation'))
    )
    and not exists (
      select 1
      from public.faq_services fs
      where fs.faq_id = f.id
        and fs.service_id = s.id
    );

  -- Additional blog posts (beyond the initial starter content)
  insert into public.blog_posts (
    business_id,
    title,
    slug,
    excerpt,
    status,
    is_featured,
    published_at,
    read_time_minutes,
    meta_title,
    meta_description,
    content
  )
  select
    v_business_id,
    'How Often Should You Inspect Your Roof? A Seasonal Guide',
    'how-often-to-inspect-your-roof',
    'A practical roof inspection schedule for homeowners, including when to book a professional check after storms.',
    'published'::public.post_status,
    false,
    now() - interval '2 days',
    5,
    'How Often to Inspect Your Roof | Summit Roofing Blog',
    'Learn when to inspect your roof and when to call Summit Roofing for a professional inspection.',
    jsonb_build_array(
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'A roof inspection schedule is one of the easiest ways to catch small issues before they become leaks. Most homeowners benefit from a simple routine: seasonal visual checks from the ground, one professional inspection each year, and an extra inspection after major hail or wind events.')),
      jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'A practical inspection rhythm', 'level', 2)),
      jsonb_build_object('type', 'list', 'data', jsonb_build_object('ordered', false, 'items', jsonb_build_array(
        'Spring: look for winter weather wear, lifted shingles, and drainage issues',
        'Summer: monitor flashing, vent penetrations, and attic heat/ventilation concerns',
        'Fall: clear debris and check gutters/downspouts before heavy rain or snow',
        'After storms: document visible damage and schedule a professional inspection'
      ))),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Routine inspections are not just about finding damage. They also help homeowners plan repairs and replacements before an urgent leak forces a rushed decision. A written inspection record can make maintenance and budgeting much easier over time.')),
      jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'When to call a roofing professional right away', 'level', 2)),
      jsonb_build_object('type', 'list', 'data', jsonb_build_object('ordered', false, 'items', jsonb_build_array(
        'New ceiling stains or attic moisture',
        'Shingles in the yard after wind',
        'Visible sagging, soft spots, or repeated leaks',
        'Recent hail or severe wind in your neighborhood'
      ))),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Summit Roofing can help document roof condition, identify repair priorities, and recommend whether ongoing maintenance, targeted repairs, or replacement planning makes the most sense.'))
    )::json
  where not exists (
    select 1 from public.blog_posts p
    where p.business_id = v_business_id and p.slug = 'how-often-to-inspect-your-roof'
  );

  insert into public.blog_posts (
    business_id,
    title,
    slug,
    excerpt,
    status,
    is_featured,
    published_at,
    read_time_minutes,
    meta_title,
    meta_description,
    content
  )
  select
    v_business_id,
    'Why Gutters Overflow (and What It Can Mean for Your Roof)',
    'why-gutters-overflow-and-what-it-means',
    'Overflowing gutters are more than a nuisance. Learn what they can reveal about drainage, roof edges, and moisture risk.',
    'published'::public.post_status,
    false,
    now() - interval '1 day',
    6,
    'Why Gutters Overflow | Summit Roofing Blog',
    'Summit Roofing explains common gutter overflow causes and what they may indicate about roof and drainage performance.',
    jsonb_build_array(
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'When gutters overflow, the issue is often blamed on leaves, but that is only one possible cause. Overflow can also point to undersized gutters, poor slope, concentrated runoff from valleys, or downspout placement that is not handling the roof''s water volume.')),
      jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Common reasons gutters overflow', 'level', 2)),
      jsonb_build_object('type', 'list', 'data', jsonb_build_object('ordered', false, 'items', jsonb_build_array(
        'Debris buildup restricting water flow',
        'Incorrect gutter slope',
        'Too few or poorly placed downspouts',
        'Undersized gutter system for roof runoff',
        'Water overshooting due to roof edge or drip edge issues'
      ))),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Overflowing gutters can contribute to fascia damage, siding staining, foundation moisture issues, and accelerated wear at lower roof edges. A proper inspection looks at both the gutter system and the roof areas feeding into it.')),
      jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'When a gutter issue becomes a roofing issue', 'level', 2)),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'If water repeatedly backs up or spills near the roofline, it can increase moisture exposure around fascia boards and eaves. That is why Summit Roofing evaluates drainage performance together with roof condition instead of treating gutters as an isolated add-on.'))
    )::json
  where not exists (
    select 1 from public.blog_posts p
    where p.business_id = v_business_id and p.slug = 'why-gutters-overflow-and-what-it-means'
  );

  -- Blog -> Service links (includes previously seeded blog posts)
  insert into public.blog_post_services (blog_post_id, service_id)
  select bp.id, s.id
  from public.blog_posts bp
  join public.services s on s.business_id = bp.business_id
  where bp.business_id = v_business_id
    and (
      (bp.slug = 'signs-you-need-a-new-roof' and s.slug in ('roof-replacement', 'roof-maintenance')) or
      (bp.slug = 'hail-storm-roof-checklist' and s.slug in ('storm-damage-inspection', 'roof-repair')) or
      (bp.slug = 'roof-repair-vs-replacement' and s.slug in ('roof-repair', 'roof-replacement')) or
      (bp.slug = 'how-often-to-inspect-your-roof' and s.slug in ('roof-maintenance', 'storm-damage-inspection')) or
      (bp.slug = 'why-gutters-overflow-and-what-it-means' and s.slug in ('gutter-installation', 'roof-maintenance', 'roof-repair'))
    )
    and not exists (
      select 1
      from public.blog_post_services bps
      where bps.blog_post_id = bp.id
        and bps.service_id = s.id
    );
end $$;
