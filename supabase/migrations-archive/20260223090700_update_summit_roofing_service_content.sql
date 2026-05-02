-- Apply expanded long-form content to Summit Roofing seeded service pages.
-- Use this if the initial seed migration has already been run.

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
    raise exception 'Unable to identify target business for Summit Roofing service content update.';
  end if;

  update public.services
  set content = jsonb_build_array(
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
  where business_id = v_business_id
    and slug = 'roof-replacement';

  update public.services
  set content = jsonb_build_array(
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
  where business_id = v_business_id
    and slug = 'roof-repair';

  update public.services
  set content = jsonb_build_array(
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
  where business_id = v_business_id
    and slug = 'storm-damage-inspection';

  update public.services
  set content = jsonb_build_array(
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
  where business_id = v_business_id
    and slug = 'gutter-installation';

  update public.services
  set content = jsonb_build_array(
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
  where business_id = v_business_id
    and slug = 'roof-maintenance';
end $$;
