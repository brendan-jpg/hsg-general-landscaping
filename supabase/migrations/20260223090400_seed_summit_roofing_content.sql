-- Seed starter content for a roofing business ("Summit Roofing").
-- Idempotent by business + slug/name checks so it can be re-run safely.

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
    raise exception 'Unable to identify target business for Summit Roofing seed content. Expected a business with slug/name "summit-roofing"/"Summit Roofing".';
  end if;

  -- Services
  insert into public.services (
    business_id,
    title,
    slug,
    excerpt,
    icon,
    is_active,
    is_featured,
    sort_order,
    price_range_min,
    price_range_max,
    meta_title,
    meta_description,
    content
  )
  select
    v_business_id,
    'Roof Replacement',
    'roof-replacement',
    'Complete residential roof replacement with material guidance, cleanup, and workmanship-focused installation.',
    'roof',
    true,
    true,
    10,
    8500,
    28000,
    'Roof Replacement | Summit Roofing',
    'Summit Roofing provides full roof replacement services with thorough inspections, transparent pricing, and clean project execution.',
    jsonb_build_array(
      jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Roof Replacement Done Right', 'level', 2)),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'When a roof has reached the end of its useful life, replacement should feel like a planned upgrade, not a stressful emergency. Summit Roofing handles roof replacement with a step-by-step process that starts with a detailed inspection and ends with a clean, weather-tight installation. We evaluate shingle condition, flashing, decking concerns, attic ventilation, and drainage patterns so the replacement plan addresses the full roofing system instead of only the visible surface.')),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Homeowners usually call us when they are seeing repeated leaks, missing shingles after storms, granule loss, or visible aging across multiple roof slopes. In many cases, patch repairs can buy time, but when repairs become frequent or damage is widespread, a full replacement is often the better long-term investment. Our goal is to give you a clear recommendation based on condition, remaining roof life, and budget priorities rather than pushing a larger project than you need.')),
      jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'What is included in a replacement project', 'level', 3)),
      jsonb_build_object('type', 'list', 'data', jsonb_build_object('ordered', false, 'items', jsonb_build_array(
        'Detailed roof and attic inspection',
        'Tear-off of old roofing materials and disposal',
        'Decking review and replacement recommendations if damaged',
        'Shingle and underlayment replacement',
        'Flashing and ventilation upgrades as needed',
        'Site protection and magnetic nail cleanup'
      ))),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Before work begins, we review the scope, material selections, and project timeline with you so there are no surprises. We explain what happens during tear-off, what conditions may require a change order (such as hidden decking damage), and how we protect landscaping, siding, driveways, and outdoor items while the project is underway. We also communicate expected work hours and cleanup procedures so you know what your property will look and sound like during installation days.')),
      jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Material selection and performance planning', 'level', 3)),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'A replacement is also a chance to improve roof performance. We help homeowners compare roofing material options based on durability, style, wind resistance, maintenance needs, and budget. We also look at ventilation and moisture management because even high-quality shingles can underperform if airflow and exhaust are not balanced. By approaching the project as a system, not just a shingle swap, we can reduce the risk of premature wear and recurring issues.')),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'During installation, our crew focuses on workmanship consistency, jobsite safety, and daily cleanup. We remove debris as the work progresses, perform magnetic sweeps for nails, and keep pathways as clear as possible. After installation, we walk the project with you, review completed work, and answer questions about maintenance and what to monitor after major weather events.')),
      jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'When to schedule a roof replacement estimate', 'level', 3)),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'If your roof is aging, has multiple problem areas, or has been patched several times in the last few years, now is the right time to schedule a replacement estimate. Planning ahead gives you more control over timing and material choices than waiting for an active leak. Summit Roofing provides straightforward recommendations, transparent pricing, and a clean installation process designed to protect your home and restore confidence in your roof.'))
    )::json
  where not exists (
    select 1 from public.services s
    where s.business_id = v_business_id and s.slug = 'roof-replacement'
  );

  insert into public.services (
    business_id, title, slug, excerpt, icon, is_active, is_featured, sort_order,
    price_range_min, price_range_max, meta_title, meta_description, content
  )
  select
    v_business_id,
    'Roof Repair',
    'roof-repair',
    'Fast, targeted roofing repairs for leaks, missing shingles, flashing failures, and storm-related damage.',
    'wrench',
    true,
    true,
    20,
    350,
    4500,
    'Roof Repair | Summit Roofing',
    'Get reliable roof repair from Summit Roofing for leaks, damaged shingles, flashing issues, and storm damage.',
    jsonb_build_array(
      jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Leak & Damage Repair', 'level', 2)),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Roof repair is most effective when the problem is identified early and repaired at the source. Summit Roofing provides targeted roof repair services for leaks, missing shingles, flashing failures, vent penetrations, and other damage that can lead to water intrusion. Instead of applying a quick patch and hoping for the best, we inspect the surrounding roof area to understand why the issue developed and what is needed to restore reliable performance.')),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Many homeowners first notice a roof problem when they see a ceiling stain, damp insulation, or shingles in the yard after a storm. The visible symptom is important, but the source of the issue may be in a different location, especially when water travels along decking or framing before showing up inside. Our repair process focuses on tracing the problem, documenting what we find, and completing repairs that match the condition and age of the existing roof system.')),
      jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Common roof repairs we handle', 'level', 3)),
      jsonb_build_object('type', 'list', 'data', jsonb_build_object('ordered', false, 'items', jsonb_build_array(
        'Leak tracing and moisture assessment',
        'Shingle and flashing repair',
        'Pipe boot and vent penetration repairs',
        'Storm damage spot repairs'
      ))),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'We also repair problem areas around chimneys, valleys, transitions, and wall intersections where flashing details are often stressed by weather and movement over time. In some cases, the repair includes replacing a section of roofing materials; in other cases, the best solution may be correcting flashing installation, resealing penetrations, or addressing a drainage issue that is forcing water where it should not go.')),
      jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Repair first, replace only when necessary', 'level', 3)),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Not every roofing issue requires a full replacement. If the roof still has useful life and the damage is localized, a well-executed repair can extend performance and protect your home at a much lower cost. We explain whether the issue appears isolated or part of a larger aging pattern so you can make a practical decision. If replacement is the smarter option, we will tell you directly and explain why, but we do not treat every leak as a replacement sale.')),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Our team aims to make repair appointments straightforward. We communicate what we can confirm during the inspection, what materials are needed, and whether weather conditions may affect timing. Once repairs are complete, we review the work and provide guidance on signs to monitor in the future, especially after high winds or hail.')),
      jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'When to call for roof repair', 'level', 3)),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Call Summit Roofing if you notice new leaks, lifted shingles, damaged flashing, or visible storm-related roof damage. Fast action usually means a smaller repair and less risk of interior damage. Our roof repair service is built around clear diagnosis, durable workmanship, and honest recommendations that help homeowners protect the life of their existing roof.'))
    )::json
  where not exists (
    select 1 from public.services s
    where s.business_id = v_business_id and s.slug = 'roof-repair'
  );

  insert into public.services (
    business_id, title, slug, excerpt, icon, is_active, is_featured, sort_order,
    price_range_min, price_range_max, meta_title, meta_description, content
  )
  select
    v_business_id,
    'Storm Damage Inspection',
    'storm-damage-inspection',
    'Roof inspections after hail and wind events with photo documentation and repair/replacement recommendations.',
    'shield',
    true,
    false,
    30,
    0,
    500,
    'Storm Damage Roof Inspection | Summit Roofing',
    'Schedule a storm damage roof inspection with Summit Roofing for hail and wind damage documentation and next-step guidance.',
    jsonb_build_array(
      jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Post-Storm Roofing Inspections', 'level', 2)),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'After hail or high winds, roof damage is not always obvious from the ground. Summit Roofing provides storm damage roof inspections designed to identify visible and developing issues before they turn into leaks, interior damage, or expensive structural repairs. We inspect shingles, flashing, roof penetrations, vents, gutters, and other exposed components, then document findings so homeowners can make informed repair or replacement decisions.')),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Even when a roof looks normal from the street, storm events can loosen shingles, damage seal strips, displace flashing, or create impact marks that shorten roof life. A timely inspection helps establish a condition record and reduces uncertainty about whether the roof is safe to leave in place, needs repairs, or should be monitored more closely over the next several months.')),
      jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'What we inspect after hail or wind events', 'level', 3)),
      jsonb_build_object('type', 'list', 'data', jsonb_build_object('ordered', false, 'items', jsonb_build_array(
        'Shingle condition, uplift, creasing, and impact damage',
        'Flashing at valleys, walls, chimneys, and transitions',
        'Roof vents, pipe boots, and other penetrations',
        'Gutters, downspouts, and metal components for impact evidence',
        'Visible signs of moisture intrusion or drainage problems'
      ))),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Our inspection notes are written to be useful, not vague. We explain what damage is present, where it is located, and whether it appears cosmetic, repairable, or severe enough to justify broader roof work. When no meaningful damage is found, we say that clearly as well. The goal is confidence and clarity, not pressure.')),
      jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Documentation and next-step planning', 'level', 3)),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Storm damage decisions often feel rushed, especially when multiple contractors are canvassing a neighborhood. Summit Roofing takes a more practical approach. We document the roof condition, discuss immediate risk areas, and recommend whether you should schedule repairs, consider replacement planning, or simply keep a record and recheck the roof after future weather events.')),
      jsonb_build_object('type', 'quote', 'data', jsonb_build_object('text', 'A documented inspection early can prevent water intrusion and larger repairs later.', 'attribution', 'Summit Roofing')),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'If your area has recently experienced hail or strong winds, scheduling an inspection now can save time and reduce uncertainty later. Summit Roofing provides clear findings, photo documentation, and straightforward recommendations so you can protect your home and choose the right next step with confidence.'))
    )::json
  where not exists (
    select 1 from public.services s
    where s.business_id = v_business_id and s.slug = 'storm-damage-inspection'
  );

  insert into public.services (
    business_id, title, slug, excerpt, icon, is_active, is_featured, sort_order,
    price_range_min, price_range_max, meta_title, meta_description, content
  )
  select
    v_business_id,
    'Gutter Installation',
    'gutter-installation',
    'Seamless gutter installation and replacement to improve drainage and protect siding, fascia, and foundations.',
    'droplet',
    true,
    false,
    40,
    1200,
    6500,
    'Gutter Installation | Summit Roofing',
    'Summit Roofing installs seamless gutters and downspouts to improve drainage and protect your home.',
    jsonb_build_array(
      jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Seamless Gutter Systems', 'level', 2)),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Gutters play a major role in protecting your roofline, siding, fascia, foundation, and landscaping. Summit Roofing installs seamless gutter systems designed to move water away from the home efficiently and consistently. If gutters are undersized, leaking at joints, pulling away from the fascia, or overflowing during normal rain, the problem is usually not just cosmetic. Poor drainage can create long-term moisture issues that affect multiple parts of the property.')),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Our gutter installation service focuses on function first. We look at roof size, slope, runoff concentration points, and downspout placement to recommend a system that actually manages water well during heavy rain. We also inspect visible signs of drainage problems such as staining, erosion, fascia damage, and overflow marks so we can correct root causes rather than replacing gutters with the same layout that was already failing.')),
      jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Gutter services and upgrades', 'level', 3)),
      jsonb_build_object('type', 'list', 'data', jsonb_build_object('ordered', false, 'items', jsonb_build_array(
        'Seamless gutter replacement',
        'Downspout placement planning',
        'Drainage performance improvements',
        'Gutter slope and flow corrections',
        'Replacement of damaged sections and components'
      ))),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'When replacing gutters, we help homeowners think beyond color and profile. Proper sizing, secure fastening, and effective downspout discharge are what keep water from backing up at the roof edge or collecting around the foundation. In some cases, a simple change in downspout location can improve drainage performance significantly. In other cases, the system needs a broader redesign to handle concentrated runoff from roof valleys or larger slopes.')),
      jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Why gutters matter for roof health', 'level', 3)),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Because Summit Roofing also works on roof repair and replacement, we see the connection between roof problems and drainage problems all the time. Overflowing or poorly draining gutters can contribute to fascia rot, moisture intrusion around eaves, and premature wear in lower roof areas. A well-installed gutter system protects the roofing system and helps preserve the exterior of the home as a whole.')),
      jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Signs your gutter system needs attention', 'level', 3)),
      jsonb_build_object('type', 'list', 'data', jsonb_build_object('ordered', false, 'items', jsonb_build_array(
        'Water spilling over edges during moderate rain',
        'Visible sagging or separation from fascia',
        'Rust spots, leaks at seams, or recurring drips',
        'Soil erosion or pooling water near the foundation',
        'Staining on siding or trim below the gutter line'
      ))),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'If your gutters are sagging, leaking, or overflowing, Summit Roofing can assess the condition and recommend practical improvements. Our goal is a clean installation and a system that directs water where it should go, even during heavier weather, so your home stays better protected year-round.'))
    )::json
  where not exists (
    select 1 from public.services s
    where s.business_id = v_business_id and s.slug = 'gutter-installation'
  );

  insert into public.services (
    business_id, title, slug, excerpt, icon, is_active, is_featured, sort_order,
    price_range_min, price_range_max, meta_title, meta_description, content
  )
  select
    v_business_id,
    'Roof Maintenance',
    'roof-maintenance',
    'Seasonal roof maintenance plans to catch wear early and extend the life of your roofing system.',
    'calendar',
    true,
    false,
    50,
    250,
    1800,
    'Roof Maintenance | Summit Roofing',
    'Prevent costly roofing problems with seasonal inspections and roof maintenance from Summit Roofing.',
    jsonb_build_array(
      jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Preventive Roof Maintenance', 'level', 2)),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Roof maintenance is one of the simplest ways to extend the life of a roofing system and reduce surprise repair costs. Summit Roofing provides preventive roof maintenance services that help homeowners identify early wear, drainage issues, and minor defects before they become active leaks or larger repairs. Most roofs do not fail all at once. They deteriorate through a series of small issues that go unnoticed until water gets inside.')),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'A maintenance visit gives you a current picture of roof condition and a chance to address small problems while they are still manageable. We inspect visible roofing components, look for signs of movement or weather-related damage, and note areas that may need monitoring over time. For homeowners with older roofs, maintenance can be especially valuable because it helps with budgeting and replacement planning instead of waiting for an emergency leak.')),
      jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'What a maintenance visit includes', 'level', 3)),
      jsonb_build_object('type', 'list', 'data', jsonb_build_object('ordered', false, 'items', jsonb_build_array(
        'Seasonal visual inspections',
        'Minor sealant and flashing touch-ups',
        'Debris and drainage checks',
        'Service notes for future planning'
      ))),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Maintenance is not a substitute for major repairs or replacement when a roof is failing, but it is a strong way to slow avoidable deterioration. Simple issues such as clogged drainage paths, aging sealant at penetrations, and loose components can create bigger moisture problems when ignored through multiple weather cycles. Catching and correcting those issues early improves reliability and helps homeowners avoid reactive scheduling during peak storm seasons.')),
      jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Who benefits most from roof maintenance', 'level', 3)),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Roof maintenance is a smart fit for homeowners with aging roofs, homes with lots of tree debris, properties that have had previous repairs, and anyone who wants a more predictable approach to exterior upkeep. It is also useful after storms when the roof appears fine but you want a professional check and documented condition notes.')),
      jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Recommended maintenance timing', 'level', 3)),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'For most homes, we recommend scheduling roof maintenance at least once a year and after major storm events. Homes with heavy tree coverage or known drainage trouble spots may benefit from seasonal checkups. Consistent maintenance does not eliminate all roofing risk, but it gives you better visibility into condition changes and helps you make decisions before small issues become disruptive leaks.')),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Summit Roofing approaches maintenance as long-term risk reduction, not a rushed upsell. We will let you know what is in good shape, what needs attention now, and what should be watched over time. That gives you a practical maintenance record and a clearer path for future roof repair or replacement decisions when the time comes.'))
    )::json
  where not exists (
    select 1 from public.services s
    where s.business_id = v_business_id and s.slug = 'roof-maintenance'
  );

  -- Areas (Denver metro starter set; adjust as needed)
  insert into public.service_areas (
    business_id, name, slug, is_active, latitude, longitude, radius_miles, zip_codes,
    meta_title, meta_description, content
  )
  select
    v_business_id,
    'Denver',
    'denver',
    true,
    39.7392,
    -104.9903,
    20,
    array['80202','80203','80204','80205','80206'],
    'Roofing Services in Denver | Summit Roofing',
    'Summit Roofing provides roof repair, replacement, and storm damage inspections in Denver.',
    jsonb_build_array(
      jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Roofing Services in Denver', 'level', 2)),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Summit Roofing serves Denver homeowners with responsive roof repair, replacement estimates, and storm damage inspections.')),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'We tailor material and ventilation recommendations to the age and condition of the home and roof system.'))
    )::json
  where not exists (
    select 1 from public.service_areas a
    where a.business_id = v_business_id and a.slug = 'denver'
  );

  insert into public.service_areas (
    business_id, name, slug, is_active, latitude, longitude, radius_miles, zip_codes,
    meta_title, meta_description, content
  )
  select
    v_business_id,
    'Lakewood',
    'lakewood',
    true,
    39.7047,
    -105.0814,
    18,
    array['80214','80215','80226','80227','80228'],
    'Roofing Services in Lakewood | Summit Roofing',
    'Roof repair and roof replacement services in Lakewood from Summit Roofing.',
    jsonb_build_array(
      jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Lakewood Roofing Contractors', 'level', 2)),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'From leak repair to full roof replacement, Summit Roofing serves Lakewood with clear scopes and dependable scheduling.'))
    )::json
  where not exists (
    select 1 from public.service_areas a
    where a.business_id = v_business_id and a.slug = 'lakewood'
  );

  insert into public.service_areas (
    business_id, name, slug, is_active, latitude, longitude, radius_miles, zip_codes,
    meta_title, meta_description, content
  )
  select
    v_business_id,
    'Aurora',
    'aurora',
    true,
    39.7294,
    -104.8319,
    20,
    array['80010','80012','80013','80014','80015'],
    'Roofing Services in Aurora | Summit Roofing',
    'Summit Roofing provides storm inspections, roof repair, and replacement services in Aurora.',
    jsonb_build_array(
      jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Aurora Roof Repair & Replacement', 'level', 2)),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Aurora weather can be hard on roofing systems. Summit Roofing helps homeowners assess storm damage and plan repairs or replacement work.'))
    )::json
  where not exists (
    select 1 from public.service_areas a
    where a.business_id = v_business_id and a.slug = 'aurora'
  );

  insert into public.service_areas (
    business_id, name, slug, is_active, latitude, longitude, radius_miles, zip_codes,
    meta_title, meta_description, content
  )
  select
    v_business_id,
    'Littleton',
    'littleton',
    true,
    39.6133,
    -105.0166,
    18,
    array['80120','80121','80122','80123','80128'],
    'Roofing Services in Littleton | Summit Roofing',
    'Summit Roofing serves Littleton with roof maintenance, roof repair, and roof replacement services.',
    jsonb_build_array(
      jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Littleton Roofing Services', 'level', 2)),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'We help Littleton homeowners stay ahead of leaks and aging roofing systems with inspections, repairs, and replacement planning.'))
    )::json
  where not exists (
    select 1 from public.service_areas a
    where a.business_id = v_business_id and a.slug = 'littleton'
  );

  insert into public.service_areas (
    business_id, name, slug, is_active, latitude, longitude, radius_miles, zip_codes,
    meta_title, meta_description, content
  )
  select
    v_business_id,
    'Arvada',
    'arvada',
    true,
    39.8028,
    -105.0875,
    18,
    array['80002','80003','80004','80005','80007'],
    'Roofing Services in Arvada | Summit Roofing',
    'Roof replacement, roof repair, and storm damage inspections in Arvada from Summit Roofing.',
    jsonb_build_array(
      jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Arvada Roofing Contractor', 'level', 2)),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Summit Roofing provides practical roofing solutions for Arvada homes, from emergency repairs to planned replacements.'))
    )::json
  where not exists (
    select 1 from public.service_areas a
    where a.business_id = v_business_id and a.slug = 'arvada'
  );

  -- Blog posts
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
    '5 Signs It Might Be Time to Replace Your Roof',
    'signs-you-need-a-new-roof',
    'Learn the common warning signs that indicate your roof may need replacement instead of another repair.',
    'published'::public.post_status,
    true,
    now() - interval '14 days',
    6,
    '5 Signs You Need a New Roof | Summit Roofing Blog',
    'Summit Roofing explains the most common signs that a roof may need full replacement.',
    jsonb_build_array(
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Homeowners often wait until a leak appears, but roof replacement is usually easier and less expensive when planned before major interior damage starts.')),
      jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Common replacement warning signs', 'level', 2)),
      jsonb_build_object('type', 'list', 'data', jsonb_build_object('ordered', false, 'items', jsonb_build_array(
        'Shingles curling, cracking, or losing granules',
        'Repeated repairs in multiple roof areas',
        'Soft spots or signs of decking damage',
        'Roof age approaching material lifespan',
        'Visible storm damage across multiple slopes'
      ))),
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'A professional inspection can help determine whether targeted repairs will hold or whether replacement is the smarter long-term option.'))
    )::json
  where not exists (
    select 1 from public.blog_posts p
    where p.business_id = v_business_id and p.slug = 'signs-you-need-a-new-roof'
  );

  insert into public.blog_posts (
    business_id, title, slug, excerpt, status, is_featured, published_at, read_time_minutes,
    meta_title, meta_description, content
  )
  select
    v_business_id,
    'What to Do After a Hail Storm: Roof Checklist',
    'hail-storm-roof-checklist',
    'A practical step-by-step checklist for homeowners after a hail storm, including what to document and when to call a roofer.',
    'published'::public.post_status,
    false,
    now() - interval '9 days',
    5,
    'Hail Storm Roof Checklist | Summit Roofing Blog',
    'Use this post-storm roof checklist from Summit Roofing to document damage and plan next steps.',
    jsonb_build_array(
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'After a hail storm, safety comes first. Avoid climbing on the roof and start by documenting visible signs of damage from the ground.')),
      jsonb_build_object('type', 'list', 'data', jsonb_build_object('ordered', true, 'items', jsonb_build_array(
        'Take photos of shingles, gutters, and downspouts from safe vantage points',
        'Check ceilings and attic spaces for new water stains',
        'Record the date of the storm and neighborhood impact',
        'Schedule a roofing inspection for a professional assessment'
      ))),
      jsonb_build_object('type', 'quote', 'data', jsonb_build_object('text', 'Good documentation makes repair planning faster and reduces confusion later.', 'attribution', 'Summit Roofing'))
    )::json
  where not exists (
    select 1 from public.blog_posts p
    where p.business_id = v_business_id and p.slug = 'hail-storm-roof-checklist'
  );

  insert into public.blog_posts (
    business_id, title, slug, excerpt, status, is_featured, published_at, read_time_minutes,
    meta_title, meta_description, content
  )
  select
    v_business_id,
    'Roof Repair vs. Roof Replacement: How to Decide',
    'roof-repair-vs-replacement',
    'Not sure whether to repair or replace your roof? Here is how Summit Roofing evaluates the decision.',
    'published'::public.post_status,
    false,
    now() - interval '4 days',
    7,
    'Roof Repair vs Replacement | Summit Roofing Blog',
    'Summit Roofing outlines the key factors that help homeowners decide between roof repair and roof replacement.',
    jsonb_build_array(
      jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'The right choice depends on roof age, damage location, repair history, and how long you plan to stay in the home.')),
      jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'When repair usually makes sense', 'level', 2)),
      jsonb_build_object('type', 'list', 'data', jsonb_build_object('ordered', false, 'items', jsonb_build_array(
        'Damage is limited to a small area',
        'Roof is relatively new',
        'Underlying decking and ventilation are in good shape'
      ))),
      jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'When replacement is the better long-term move', 'level', 2)),
      jsonb_build_object('type', 'list', 'data', jsonb_build_object('ordered', false, 'items', jsonb_build_array(
        'Damage is widespread or recurring',
        'Roof is near the end of its lifespan',
        'Repair costs are approaching replacement value'
      )))
    )::json
  where not exists (
    select 1 from public.blog_posts p
    where p.business_id = v_business_id and p.slug = 'roof-repair-vs-replacement'
  );

  -- Link all seeded Areas to all seeded services (idempotent)
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
    s.title || ' in ' || a.name || ' | Summit Roofing',
    'Summit Roofing offers ' || lower(s.title) || ' in ' || a.name || '.'
  from public.service_areas a
  join public.services s
    on s.business_id = a.business_id
  where a.business_id = v_business_id
    and a.slug in ('denver', 'lakewood', 'aurora', 'littleton', 'arvada')
    and s.slug in ('roof-replacement', 'roof-repair', 'storm-damage-inspection', 'gutter-installation', 'roof-maintenance')
    and not exists (
      select 1
      from public.service_area_services sas
      where sas.service_area_id = a.id
        and sas.service_id = s.id
    );
end $$;
