do $$
declare
  target_business_id uuid;
  target_template_id uuid;
  template_subject text := 'New lead: {{customer_name}}';
  template_body_html text := '<div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6;"><p style="margin:0 0 16px;font-size:16px;">A new lead just came in on {{submitted_at}}.</p><div style="margin:0 0 20px;padding:16px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;"><p style="margin:0 0 10px;"><strong>Name:</strong> {{customer_name}}</p><p style="margin:0 0 10px;"><strong>Email:</strong> {{lead_email}}</p><p style="margin:0 0 10px;"><strong>Phone:</strong> {{lead_phone}}</p><p style="margin:0 0 10px;"><strong>Address:</strong> {{lead_address}}</p><p style="margin:0;"><strong>Form Type:</strong> {{form_type}}</p></div><div style="padding:16px;border-left:4px solid #111827;background:#ffffff;"><p style="margin:0 0 8px;"><strong>Message</strong></p><p style="margin:0;">{{lead_message}}</p></div></div>';
  template_body_text text := 'A new lead just came in on {{submitted_at}}.\n\nName: {{customer_name}}\n\nEmail: {{lead_email}}\n\nPhone: {{lead_phone}}\n\nAddress: {{lead_address}}\n\nForm Type: {{form_type}}\n\nMessage: {{lead_message}}';
begin
  select b.id
  into target_business_id
  from businesses b
  where lower(coalesce(b.domain, '')) = 'generallandscaping.com'
     or exists (
       select 1
       from business_domains d
       where d.business_id = b.id
         and d.is_active = true
         and lower(coalesce(d.domain, '')) in ('generallandscaping.com', 'www.generallandscaping.com')
     )
  limit 1;

  if target_business_id is null then
    raise exception 'Could not find General Landscaping business';
  end if;

  select nullif((b.settings ->> 'system_email_template_new_lead_notification_id'), '')::uuid
  into target_template_id
  from businesses b
  where b.id = target_business_id;

  if target_template_id is not null and exists (
    select 1
    from email_templates t
    where t.id = target_template_id
      and t.business_id = target_business_id
  ) then
    update email_templates
    set
      name = 'New Lead Notification',
      type = 'custom',
      subject = template_subject,
      body_html = template_body_html,
      body_text = template_body_text,
      is_active = true,
      updated_at = now()
    where id = target_template_id
      and business_id = target_business_id;
  else
    insert into email_templates (
      business_id,
      name,
      type,
      is_active,
      subject,
      body_html,
      body_text
    )
    values (
      target_business_id,
      'New Lead Notification',
      'custom',
      true,
      template_subject,
      template_body_html,
      template_body_text
    )
    returning id into target_template_id;
  end if;

  update businesses
  set settings = jsonb_set(
    coalesce(settings, '{}'::jsonb),
    '{system_email_template_new_lead_notification_id}',
    to_jsonb(target_template_id::text),
    true
  )
  where id = target_business_id;
end $$;
