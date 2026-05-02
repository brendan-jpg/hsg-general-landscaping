-- Seed starter testimonials linked to existing Summit Roofing services.
-- Idempotent by business + customer_name + content checks so it can be re-run safely.

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
    raise exception 'Unable to identify target business for testimonial seed content. Expected a business with slug/name "summit-roofing"/"Summit Roofing".';
  end if;

  insert into public.testimonials (
    business_id,
    customer_name,
    customer_location,
    content,
    rating,
    review_date,
    source,
    is_featured,
    is_active,
    service_id
  )
  select
    v_business_id,
    'Angela M.',
    'Denver, CO',
    'Summit Roofing replaced our roof after years of patching leaks. The estimate was clear, the crew showed up when scheduled, and the cleanup was better than we expected. They walked us through the finished work and answered every question without rushing us.',
    5,
    (current_date - interval '42 days')::date,
    'google'::public.testimonial_source,
    true,
    true,
    s.id
  from public.services s
  where s.business_id = v_business_id
    and s.slug = 'roof-replacement'
    and not exists (
      select 1 from public.testimonials t
      where t.business_id = v_business_id
        and t.customer_name = 'Angela M.'
        and t.content = 'Summit Roofing replaced our roof after years of patching leaks. The estimate was clear, the crew showed up when scheduled, and the cleanup was better than we expected. They walked us through the finished work and answered every question without rushing us.'
    );

  insert into public.testimonials (
    business_id, customer_name, customer_location, content, rating, review_date, source, is_featured, is_active, service_id
  )
  select
    v_business_id,
    'Marcus T.',
    'Lakewood, CO',
    'We had a leak around a vent after a storm and they fixed it quickly. What I appreciated most was that they explained what failed and why it did not require a full replacement yet. Fair pricing and very straightforward communication.',
    5,
    (current_date - interval '31 days')::date,
    'manual'::public.testimonial_source,
    false,
    true,
    s.id
  from public.services s
  where s.business_id = v_business_id
    and s.slug = 'roof-repair'
    and not exists (
      select 1 from public.testimonials t
      where t.business_id = v_business_id
        and t.customer_name = 'Marcus T.'
        and t.content = 'We had a leak around a vent after a storm and they fixed it quickly. What I appreciated most was that they explained what failed and why it did not require a full replacement yet. Fair pricing and very straightforward communication.'
    );

  insert into public.testimonials (
    business_id, customer_name, customer_location, content, rating, review_date, source, is_featured, is_active, service_id
  )
  select
    v_business_id,
    'Priya S.',
    'Aurora, CO',
    'After a hail storm, Summit Roofing documented everything and gave us a clear inspection summary with photos. They were calm, thorough, and did not pressure us into replacing the roof before it was necessary.',
    5,
    (current_date - interval '25 days')::date,
    'google'::public.testimonial_source,
    true,
    true,
    s.id
  from public.services s
  where s.business_id = v_business_id
    and s.slug = 'storm-damage-inspection'
    and not exists (
      select 1 from public.testimonials t
      where t.business_id = v_business_id
        and t.customer_name = 'Priya S.'
        and t.content = 'After a hail storm, Summit Roofing documented everything and gave us a clear inspection summary with photos. They were calm, thorough, and did not pressure us into replacing the roof before it was necessary.'
    );

  insert into public.testimonials (
    business_id, customer_name, customer_location, content, rating, review_date, source, is_featured, is_active, service_id
  )
  select
    v_business_id,
    'Daniel R.',
    'Littleton, CO',
    'Our old gutters overflowed every time it rained hard. Summit Roofing redesigned the downspout layout and installed new seamless gutters that actually handle the water. No more overflow at the front entry.',
    5,
    (current_date - interval '18 days')::date,
    'manual'::public.testimonial_source,
    false,
    true,
    s.id
  from public.services s
  where s.business_id = v_business_id
    and s.slug = 'gutter-installation'
    and not exists (
      select 1 from public.testimonials t
      where t.business_id = v_business_id
        and t.customer_name = 'Daniel R.'
        and t.content = 'Our old gutters overflowed every time it rained hard. Summit Roofing redesigned the downspout layout and installed new seamless gutters that actually handle the water. No more overflow at the front entry.'
    );

  insert into public.testimonials (
    business_id, customer_name, customer_location, content, rating, review_date, source, is_featured, is_active, service_id
  )
  select
    v_business_id,
    'Holly W.',
    'Arvada, CO',
    'We signed up for maintenance after a few surprise leaks over the years. The inspection notes were detailed, and they pointed out a couple of small issues before they turned into bigger repairs. It feels much more proactive now.',
    5,
    (current_date - interval '11 days')::date,
    'manual'::public.testimonial_source,
    false,
    true,
    s.id
  from public.services s
  where s.business_id = v_business_id
    and s.slug = 'roof-maintenance'
    and not exists (
      select 1 from public.testimonials t
      where t.business_id = v_business_id
        and t.customer_name = 'Holly W.'
        and t.content = 'We signed up for maintenance after a few surprise leaks over the years. The inspection notes were detailed, and they pointed out a couple of small issues before they turned into bigger repairs. It feels much more proactive now.'
    );

  -- One general testimonial (not tied to a specific service)
  insert into public.testimonials (
    business_id, customer_name, customer_location, content, rating, review_date, source, is_featured, is_active, service_id
  )
  select
    v_business_id,
    'Kevin and Laura B.',
    'Denver Metro',
    'From the first estimate to the final walkthrough, Summit Roofing was organized and easy to work with. They communicated scheduling changes, kept the site clean, and followed through on everything they promised.',
    5,
    (current_date - interval '7 days')::date,
    'manual'::public.testimonial_source,
    true,
    true,
    null
  where not exists (
    select 1 from public.testimonials t
    where t.business_id = v_business_id
      and t.customer_name = 'Kevin and Laura B.'
      and t.content = 'From the first estimate to the final walkthrough, Summit Roofing was organized and easy to work with. They communicated scheduling changes, kept the site clean, and followed through on everything they promised.'
  );
end $$;
