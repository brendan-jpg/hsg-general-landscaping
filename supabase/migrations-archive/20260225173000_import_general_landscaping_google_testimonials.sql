-- Import Google testimonials for General Landscaping from provided review text.
-- Idempotent by business + customer_name + content so it can be re-run safely.

do $$
declare
  v_business_id uuid;
  v_business_count integer;
begin
  select count(*) into v_business_count from public.businesses;

  select b.id
  into v_business_id
  from public.businesses b
  where lower(coalesce(b.slug, '')) in ('general-landscaping', 'hsg')
     or lower(coalesce(b.name, '')) like '%general landscaping%'
  order by b.created_at asc
  limit 1;

  if v_business_id is null and v_business_count = 1 then
    select id into v_business_id from public.businesses order by created_at asc limit 1;
    raise notice 'General Landscaping business not found by slug/name. Using the only business in the database: %', v_business_id;
  end if;

  if v_business_id is null then
    raise exception 'Unable to identify target business for testimonial import. Expected slug/name matching General Landscaping or HSG.';
  end if;

  insert into public.testimonials (
    business_id, customer_name, customer_location, content, rating, review_date, source, is_featured, is_active, service_id
  )
  select
    v_business_id,
    'Bethany Zapadka',
    null,
    'What a great experience doing business with General Landscaping!! First we met with Jarrod, the landscape designer, who was punctual and professional and did exactly what we were looking for. Then the installation crew came out quickly after our first meeting....they ripped out our original foundation planting, and installed fresh, younger nursery stock. They did the job in just over a day...paying attention to detail, and being super neat and tidy. Look no further for a professional, dependable landscape company!!',
    5,
    null,
    'google'::public.testimonial_source,
    false,
    true,
    null
  where not exists (
    select 1 from public.testimonials t
    where t.business_id = v_business_id
      and t.customer_name = 'Bethany Zapadka'
      and t.content = 'What a great experience doing business with General Landscaping!! First we met with Jarrod, the landscape designer, who was punctual and professional and did exactly what we were looking for. Then the installation crew came out quickly after our first meeting....they ripped out our original foundation planting, and installed fresh, younger nursery stock. They did the job in just over a day...paying attention to detail, and being super neat and tidy. Look no further for a professional, dependable landscape company!!'
  );

  insert into public.testimonials (
    business_id, customer_name, customer_location, content, rating, review_date, source, is_featured, is_active, service_id
  )
  select
    v_business_id,
    'Kim Talarczyk',
    null,
    '*updated at project completion* The work of General Landscaping is top notch. We had a few issues getting our patio and landscaping project started with some poor communication at the start when there was a supply issue. We had no issue with the supply delay but wished for more communication up front about options and start times. However once the worked kicked off the crews were amazing, professional, and did an outstanding job. The design that Jarrod did was excellent and we''re really happy with the result.',
    5,
    null,
    'google'::public.testimonial_source,
    false,
    true,
    null
  where not exists (
    select 1 from public.testimonials t
    where t.business_id = v_business_id
      and t.customer_name = 'Kim Talarczyk'
      and t.content = '*updated at project completion* The work of General Landscaping is top notch. We had a few issues getting our patio and landscaping project started with some poor communication at the start when there was a supply issue. We had no issue with the supply delay but wished for more communication up front about options and start times. However once the worked kicked off the crews were amazing, professional, and did an outstanding job. The design that Jarrod did was excellent and we''re really happy with the result.'
  );

  insert into public.testimonials (
    business_id, customer_name, customer_location, content, rating, review_date, source, is_featured, is_active, service_id
  )
  select
    v_business_id,
    'Judith Riccio',
    null,
    'We are so happy with our beautiful new patio! Paul, Chris, and Scott are true artisans and clearly and justifiably take great pride in their work! Jarrod designed the patio and all the beautiful landscaping which will be installed next. He is wonderful to work with as well. Our new neighbors recommended General Landscaping to us, and I am so grateful that they did!',
    5,
    null,
    'google'::public.testimonial_source,
    false,
    true,
    null
  where not exists (
    select 1 from public.testimonials t
    where t.business_id = v_business_id
      and t.customer_name = 'Judith Riccio'
      and t.content = 'We are so happy with our beautiful new patio! Paul, Chris, and Scott are true artisans and clearly and justifiably take great pride in their work! Jarrod designed the patio and all the beautiful landscaping which will be installed next. He is wonderful to work with as well. Our new neighbors recommended General Landscaping to us, and I am so grateful that they did!'
  );

  insert into public.testimonials (
    business_id, customer_name, customer_location, content, rating, review_date, source, is_featured, is_active, service_id
  )
  select
    v_business_id,
    'Robbie J',
    null,
    'Such a pleasure to work with! We had both landscaping work done and paver/cobblestone work done as well. From the design phase with Jarrod, to the final implementation by Jeff and his team, we are very happy and impressed with the results. Paul and Scott did a great job with the hardscape work. Looking forward to working with them on future projects and will highly recommend General to everyone!',
    5,
    null,
    'google'::public.testimonial_source,
    false,
    true,
    null
  where not exists (
    select 1 from public.testimonials t
    where t.business_id = v_business_id
      and t.customer_name = 'Robbie J'
      and t.content = 'Such a pleasure to work with! We had both landscaping work done and paver/cobblestone work done as well. From the design phase with Jarrod, to the final implementation by Jeff and his team, we are very happy and impressed with the results. Paul and Scott did a great job with the hardscape work. Looking forward to working with them on future projects and will highly recommend General to everyone!'
  );

  insert into public.testimonials (
    business_id, customer_name, customer_location, content, rating, review_date, source, is_featured, is_active, service_id
  )
  select
    v_business_id,
    'Richard Brayall',
    'Glastonbury, CT',
    'Our first experience with General Landscaping (Glastonbury, CT) was such a pleasant and easy experience for us. The crew that came out was very professional, on time, and took directives from Jeff in a very professional manner and took care of any concerns or needs. We are very pleased with the end result and are receiving many compliments from neighbors and friends. We highly recommend General Landscaping for your landscaping needs and we will definitely use them in the future.',
    5,
    null,
    'google'::public.testimonial_source,
    false,
    true,
    null
  where not exists (
    select 1 from public.testimonials t
    where t.business_id = v_business_id
      and t.customer_name = 'Richard Brayall'
      and t.content = 'Our first experience with General Landscaping (Glastonbury, CT) was such a pleasant and easy experience for us. The crew that came out was very professional, on time, and took directives from Jeff in a very professional manner and took care of any concerns or needs. We are very pleased with the end result and are receiving many compliments from neighbors and friends. We highly recommend General Landscaping for your landscaping needs and we will definitely use them in the future.'
  );

  insert into public.testimonials (
    business_id, customer_name, customer_location, content, rating, review_date, source, is_featured, is_active, service_id
  )
  select
    v_business_id,
    'Tperki',
    null,
    'We had General Landscaping rip out all the old plantings in front of our house and install new ones. Jarrod at General did a fabulous site plan with ideas for all the plantings. The crew were in and out in about half a day. We love the new look. I highly recommend General Landscaping!',
    5,
    null,
    'google'::public.testimonial_source,
    false,
    true,
    null
  where not exists (
    select 1 from public.testimonials t
    where t.business_id = v_business_id
      and t.customer_name = 'Tperki'
      and t.content = 'We had General Landscaping rip out all the old plantings in front of our house and install new ones. Jarrod at General did a fabulous site plan with ideas for all the plantings. The crew were in and out in about half a day. We love the new look. I highly recommend General Landscaping!'
  );

  insert into public.testimonials (
    business_id, customer_name, customer_location, content, rating, review_date, source, is_featured, is_active, service_id
  )
  select
    v_business_id,
    'Dale Bidwell',
    null,
    'We were selling the house and asked GL to provide mowing weekly. The crew of 4 did an excellent job every week. Scott had his crews do a few odd jobs around the yard. Always received high quality work. We definitely recommend General Landscaping.',
    5,
    null,
    'google'::public.testimonial_source,
    false,
    true,
    null
  where not exists (
    select 1 from public.testimonials t
    where t.business_id = v_business_id
      and t.customer_name = 'Dale Bidwell'
      and t.content = 'We were selling the house and asked GL to provide mowing weekly. The crew of 4 did an excellent job every week. Scott had his crews do a few odd jobs around the yard. Always received high quality work. We definitely recommend General Landscaping.'
  );

  insert into public.testimonials (
    business_id, customer_name, customer_location, content, rating, review_date, source, is_featured, is_active, service_id
  )
  select
    v_business_id,
    'Sam Pines',
    null,
    'General Landscaping repaired a few of the steps at my condo last year. The concrete work completely turned into sand and fell apart over the winter. I began calling in March and was told Paul would come look at the steps. He did call me once and said that maybe the salt treatment this past winter was the cause, but he would look at it and get back to me. No call back. If the treatment was the issue, why are the other FIVE steps they did not touch perfectly fine???? I have left multiple messages for Paul since March with no call back. It is now August. This company does not honor their work. I recommend finding another source for your landscaping needs.',
    1,
    null,
    'google'::public.testimonial_source,
    false,
    true,
    null
  where not exists (
    select 1 from public.testimonials t
    where t.business_id = v_business_id
      and t.customer_name = 'Sam Pines'
      and t.content = 'General Landscaping repaired a few of the steps at my condo last year. The concrete work completely turned into sand and fell apart over the winter. I began calling in March and was told Paul would come look at the steps. He did call me once and said that maybe the salt treatment this past winter was the cause, but he would look at it and get back to me. No call back. If the treatment was the issue, why are the other FIVE steps they did not touch perfectly fine???? I have left multiple messages for Paul since March with no call back. It is now August. This company does not honor their work. I recommend finding another source for your landscaping needs.'
  );

  insert into public.testimonials (
    business_id, customer_name, customer_location, content, rating, review_date, source, is_featured, is_active, service_id
  )
  select
    v_business_id,
    '5th Wheel',
    null,
    'Before the snowstorm hit we asked these guys to take down some rotten tree stumps and hedge some of the bushes around our house. They came earlier than expected and got right to work and they finished the job in less time than what they quoted. All these guys are very professional and that''s a nice fresh of air. We''ve had some pretty bad experiences with landscapers in the past but these guys are the real deal! Great work guys! We''ll definitely recommend you in the future!',
    5,
    null,
    'google'::public.testimonial_source,
    false,
    true,
    null
  where not exists (
    select 1 from public.testimonials t
    where t.business_id = v_business_id
      and t.customer_name = '5th Wheel'
      and t.content = 'Before the snowstorm hit we asked these guys to take down some rotten tree stumps and hedge some of the bushes around our house. They came earlier than expected and got right to work and they finished the job in less time than what they quoted. All these guys are very professional and that''s a nice fresh of air. We''ve had some pretty bad experiences with landscapers in the past but these guys are the real deal! Great work guys! We''ll definitely recommend you in the future!'
  );

  insert into public.testimonials (
    business_id, customer_name, customer_location, content, rating, review_date, source, is_featured, is_active, service_id
  )
  select
    v_business_id,
    'Jared Martillotti',
    null,
    'We have been a customer for many years and have always been happy with their work. They mow our lawn, do spring and fall cleanups, and weed/mulch for us every year. They do a great job, and in the few instances where they''ve had a misstep, they were quick to rectify.',
    5,
    null,
    'google'::public.testimonial_source,
    false,
    true,
    null
  where not exists (
    select 1 from public.testimonials t
    where t.business_id = v_business_id
      and t.customer_name = 'Jared Martillotti'
      and t.content = 'We have been a customer for many years and have always been happy with their work. They mow our lawn, do spring and fall cleanups, and weed/mulch for us every year. They do a great job, and in the few instances where they''ve had a misstep, they were quick to rectify.'
  );

  insert into public.testimonials (
    business_id, customer_name, customer_location, content, rating, review_date, source, is_featured, is_active, service_id
  )
  select
    v_business_id,
    'Bud modlesky',
    null,
    'If your job is t big enough they probably won''t give you the time of day! I went to the office last fall and this spring to get a part of my yard hydro seeded because they did my majors of the yard a few years ago. Not 1 return call and when I called to have them call me .... No return call. Too bad!',
    1,
    null,
    'google'::public.testimonial_source,
    false,
    true,
    null
  where not exists (
    select 1 from public.testimonials t
    where t.business_id = v_business_id
      and t.customer_name = 'Bud modlesky'
      and t.content = 'If your job is t big enough they probably won''t give you the time of day! I went to the office last fall and this spring to get a part of my yard hydro seeded because they did my majors of the yard a few years ago. Not 1 return call and when I called to have them call me .... No return call. Too bad!'
  );

  insert into public.testimonials (
    business_id, customer_name, customer_location, content, rating, review_date, source, is_featured, is_active, service_id
  )
  select
    v_business_id,
    'Tim Green',
    null,
    'Joe and General Landscaping team are the best. Their terra-seed process quickly and economically turned my weed-infested back yard into a beautiful, thick lawn. It matched my vision and exceeded expectations.',
    5,
    null,
    'google'::public.testimonial_source,
    false,
    true,
    null
  where not exists (
    select 1 from public.testimonials t
    where t.business_id = v_business_id
      and t.customer_name = 'Tim Green'
      and t.content = 'Joe and General Landscaping team are the best. Their terra-seed process quickly and economically turned my weed-infested back yard into a beautiful, thick lawn. It matched my vision and exceeded expectations.'
  );

  insert into public.testimonials (
    business_id, customer_name, customer_location, content, rating, review_date, source, is_featured, is_active, service_id
  )
  select
    v_business_id,
    'Chris Z',
    null,
    'Scott and Jeff are great! Awesome work product.',
    5,
    null,
    'google'::public.testimonial_source,
    false,
    true,
    null
  where not exists (
    select 1 from public.testimonials t
    where t.business_id = v_business_id
      and t.customer_name = 'Chris Z'
      and t.content = 'Scott and Jeff are great! Awesome work product.'
  );

  insert into public.testimonials (
    business_id, customer_name, customer_location, content, rating, review_date, source, is_featured, is_active, service_id
  )
  select
    v_business_id,
    'Bill Bagot',
    null,
    'Great company with attention to detail friendly kind courteous worker''s from top to bottom 100% recommend them for all your outdoor needs',
    5,
    null,
    'google'::public.testimonial_source,
    false,
    true,
    null
  where not exists (
    select 1 from public.testimonials t
    where t.business_id = v_business_id
      and t.customer_name = 'Bill Bagot'
      and t.content = 'Great company with attention to detail friendly kind courteous worker''s from top to bottom 100% recommend them for all your outdoor needs'
  );

  insert into public.testimonials (
    business_id, customer_name, customer_location, content, rating, review_date, source, is_featured, is_active, service_id
  )
  select
    v_business_id,
    'Dave Fontano',
    null,
    'Very happy with Service, great job!!!!',
    5,
    null,
    'google'::public.testimonial_source,
    false,
    true,
    null
  where not exists (
    select 1 from public.testimonials t
    where t.business_id = v_business_id
      and t.customer_name = 'Dave Fontano'
      and t.content = 'Very happy with Service, great job!!!!'
  );

  insert into public.testimonials (
    business_id, customer_name, customer_location, content, rating, review_date, source, is_featured, is_active, service_id
  )
  select
    v_business_id,
    'Tomas Martinez',
    null,
    'Friendly and professional people',
    5,
    null,
    'google'::public.testimonial_source,
    false,
    true,
    null
  where not exists (
    select 1 from public.testimonials t
    where t.business_id = v_business_id
      and t.customer_name = 'Tomas Martinez'
      and t.content = 'Friendly and professional people'
  );
end $$;
