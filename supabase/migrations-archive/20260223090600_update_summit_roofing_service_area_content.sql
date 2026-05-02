-- Apply expanded long-form content to Summit Roofing seeded Area pages.
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
    raise exception 'Unable to identify target business for Summit Roofing Area content update.';
  end if;

  update public.service_areas
  set content = jsonb_build_array(
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Roofing Services in Denver', 'level', 2)),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Summit Roofing serves Denver homeowners with roof repair, roof replacement, storm damage inspections, and preventive maintenance backed by clear communication and practical recommendations. Denver homes see a wide range of weather conditions throughout the year, and roofing systems often show wear from sun exposure, wind, hail, and freeze-thaw cycles. Our team focuses on helping homeowners understand the condition of their roof and the right next step, whether that means a targeted repair, a maintenance plan, or replacement planning.')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'We work with homeowners across Denver who want dependable scheduling, documented inspections, and straightforward scopes of work. Our process starts with an on-site assessment of the issue or concern, then we explain what we found in plain language. If a repair is the best option, we outline the repair approach and likely results. If the roof is showing broader aging or storm damage, we explain why replacement may be the more cost-effective long-term decision.')),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Denver roofing services from Summit Roofing', 'level', 3)),
    jsonb_build_object('type', 'list', 'data', jsonb_build_object('ordered', false, 'items', jsonb_build_array(
      'Roof leak diagnosis and repair',
      'Full roof replacement and installation',
      'Storm damage roof inspections',
      'Gutter installation and drainage improvements',
      'Preventive roof maintenance'
    ))),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Denver neighborhoods include a mix of older homes and newer builds, which means roof systems can vary significantly in materials, age, and installation quality. We tailor recommendations to the actual condition of the roof and the goals of the homeowner instead of using a one-size-fits-all approach. That may include prioritizing immediate leak protection, planning for a future replacement window, or improving drainage to protect fascia and siding.')),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Storm damage and seasonal roof concerns in Denver', 'level', 3)),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Denver weather can change quickly, and strong winds or hail can create roof problems that are not obvious from the ground. After major storms, Summit Roofing provides inspections that document visible damage and identify areas that may need repairs or monitoring. Even when there is no immediate leak, loose shingles, flashing damage, and impact marks can shorten roof life if left unaddressed.')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'If you are in Denver and need a roofer who values clarity, workmanship, and realistic recommendations, Summit Roofing is ready to help. We focus on protecting your home, reducing uncertainty, and giving you a clear path forward for your roof.'))
  )::json
  where business_id = v_business_id
    and slug = 'denver';

  update public.service_areas
  set content = jsonb_build_array(
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Lakewood Roofing Contractors', 'level', 2)),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Summit Roofing provides roof repair, roof replacement, and storm damage inspection services for homeowners in Lakewood. We work with homeowners who need fast leak diagnosis as well as those planning proactive roof replacement before larger problems develop. Our approach is built around inspection-first recommendations, clear scope explanations, and workmanship that addresses the full roofing system, including flashing, ventilation, and drainage considerations.')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Many Lakewood homes have roofing systems at different stages of aging, and the right solution depends on more than the visible surface. During inspections, we look at the condition of shingles, flashing details, roof penetrations, and drainage performance so we can recommend repairs that last or replacement work that solves recurring issues. We focus on practical guidance so homeowners can make confident decisions without feeling pressured.')),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Roofing work we provide in Lakewood', 'level', 3)),
    jsonb_build_object('type', 'list', 'data', jsonb_build_object('ordered', false, 'items', jsonb_build_array(
      'Roof leak and storm damage repairs',
      'Complete roof replacement',
      'Post-storm inspection and documentation',
      'Gutter replacement and drainage corrections',
      'Annual and seasonal roof maintenance'
    ))),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'We understand that roofing work affects the entire household schedule. Summit Roofing communicates project timing, expected noise and cleanup, and any conditions that may affect the final scope. Whether we are completing a smaller repair or a full replacement, our goal is to keep the process organized and reduce surprises.')),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Why Lakewood homeowners choose Summit Roofing', 'level', 3)),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Homeowners in Lakewood often call us because they want a roofer who will explain what is wrong, what can wait, and what needs immediate attention. We prioritize honest assessments and durable work, especially for leaks and flashing problems that can lead to recurring interior damage when poorly repaired.')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'If your Lakewood home has roof damage, an aging roof, or drainage issues around the roofline, Summit Roofing can inspect the system and recommend the right next step. Our team is focused on long-term roof performance and clear communication from the first visit through project completion.'))
  )::json
  where business_id = v_business_id
    and slug = 'lakewood';

  update public.service_areas
  set content = jsonb_build_array(
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Aurora Roof Repair & Replacement', 'level', 2)),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Summit Roofing serves Aurora homeowners with roof repair, roof replacement, storm damage roof inspections, and maintenance services tailored to the condition of each home. Aurora weather can be hard on roofing systems, especially after wind and hail events, and many roofing problems begin as small issues that are easy to miss from the ground. Our job is to identify those issues early, document what we find, and recommend the most practical path forward.')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'We help Aurora homeowners with everything from isolated leak repairs to full roof replacement planning. During our inspection, we evaluate shingles, flashing, roof penetrations, and visible drainage conditions to determine whether the roof is a good candidate for repair or whether broader aging or storm damage points to replacement. We explain our recommendations clearly so you understand both short-term and long-term implications before making a decision.')),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Common Aurora roofing service requests', 'level', 3)),
    jsonb_build_object('type', 'list', 'data', jsonb_build_object('ordered', false, 'items', jsonb_build_array(
      'Leak inspection and roof repair',
      'Storm damage roof inspections after hail or wind',
      'Roof replacement estimates and installation',
      'Gutter installation and water management improvements',
      'Preventive maintenance for aging roofs'
    ))),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Our Aurora clients often want clarity after a storm: Is the roof damaged, how urgent is it, and what should be done next? Summit Roofing provides documented inspections and straightforward recommendations so you are not left guessing. If repairs are appropriate, we focus on repairing the source of the issue. If replacement is the better long-term choice, we explain why and outline the project scope and timing.')),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'A practical approach to roofing in Aurora', 'level', 3)),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'We believe roofing decisions should be based on condition, risk, and long-term value, not sales pressure. Summit Roofing works to make the process clear from the first inspection through final cleanup. That includes transparent communication, realistic timelines, and work that supports the performance of the full roof system rather than only treating visible symptoms.')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'If you are in Aurora and need a roofing contractor for repair, replacement, or storm inspection work, Summit Roofing is ready to help with dependable service and clear next-step guidance.'))
  )::json
  where business_id = v_business_id
    and slug = 'aurora';

  update public.service_areas
  set content = jsonb_build_array(
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Littleton Roofing Services', 'level', 2)),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Summit Roofing provides roof repair, roof replacement, gutter installation, and roof maintenance services for homeowners in Littleton. Whether you are dealing with an active leak, visible storm damage, or an aging roof that needs a plan, we focus on clear inspections and practical recommendations that match the condition of the home. Our team is committed to workmanship and communication that help homeowners feel informed throughout the project.')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Littleton homeowners often call us when they want to avoid repeated patchwork and understand the true condition of the roof. We inspect key problem areas such as flashing transitions, penetrations, valleys, and drainage points, then explain whether a targeted repair is likely to hold or whether replacement planning makes more sense. We do not treat every issue as an emergency replacement, but we will be direct when a roof is nearing the end of its useful life.')),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Roofing and exterior services in Littleton', 'level', 3)),
    jsonb_build_object('type', 'list', 'data', jsonb_build_object('ordered', false, 'items', jsonb_build_array(
      'Roof leak repair and flashing repairs',
      'Full roof replacement and installation',
      'Storm damage inspections and condition documentation',
      'Gutter replacement and drainage improvements',
      'Ongoing roof maintenance for aging systems'
    ))),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Our process is designed to reduce confusion. We communicate what we found during the inspection, what work is recommended now, and what can be monitored over time. When a project is scheduled, we review timing, cleanup expectations, and jobsite considerations so you know what to expect before work starts.')),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Protecting roof life in Littleton', 'level', 3)),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Roof performance depends on more than shingles alone. Ventilation, flashing, and drainage all affect how well a roof system handles weather over time. Summit Roofing looks at the full system so repairs and replacement recommendations support long-term performance instead of only addressing the most visible issue.')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'If your Littleton home needs roofing work, Summit Roofing can provide a thorough inspection and a clear path forward. We aim to make the process straightforward, dependable, and focused on protecting your home.'))
  )::json
  where business_id = v_business_id
    and slug = 'littleton';

  update public.service_areas
  set content = jsonb_build_array(
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Arvada Roofing Contractor', 'level', 2)),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Summit Roofing serves Arvada homeowners with roof repair, roof replacement, storm damage inspections, gutter installation, and preventive maintenance. We help homeowners address urgent roof problems and long-term roof planning with the same practical approach: inspect thoroughly, explain findings clearly, and recommend the work that best protects the home. Whether you have a small leak or a roof showing widespread aging, our goal is to provide dependable guidance and durable workmanship.')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Arvada homes can experience roof wear from wind exposure, storms, and normal aging over time. Many roofing issues begin around flashing details, roof penetrations, and drainage points, then become visible indoors only after water has already traveled through the system. Summit Roofing inspects both the visible problem area and surrounding roof sections so we can identify the true source and recommend repairs that last.')),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Summit Roofing services available in Arvada', 'level', 3)),
    jsonb_build_object('type', 'list', 'data', jsonb_build_object('ordered', false, 'items', jsonb_build_array(
      'Roof leak diagnosis and repair',
      'Storm damage roof inspections',
      'Roof replacement planning and installation',
      'Seamless gutter installation and drainage upgrades',
      'Routine roof maintenance and condition checks'
    ))),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'We know roofing decisions can feel urgent and expensive, especially after storms or recurring leaks. That is why we focus on transparency during the inspection and estimating process. We explain what is causing the issue, whether repair is a reasonable long-term option, and what to expect if replacement is the better solution. Our team aims to remove guesswork and help homeowners make confident decisions.')),
    jsonb_build_object('type', 'heading', 'data', jsonb_build_object('text', 'Workmanship and communication that reduce stress', 'level', 3)),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'Summit Roofing emphasizes clean job sites, clear scheduling communication, and complete project walkthroughs. For repairs, that means explaining the repaired area and what to monitor over time. For replacements, it means setting expectations for tear-off, installation, and cleanup so the project stays organized and predictable.')),
    jsonb_build_object('type', 'paragraph', 'data', jsonb_build_object('text', 'If you are looking for an Arvada roofing contractor who combines practical recommendations with quality workmanship, Summit Roofing is ready to inspect your roof and help you choose the right next step for your home.'))
  )::json
  where business_id = v_business_id
    and slug = 'arvada';
end $$;
