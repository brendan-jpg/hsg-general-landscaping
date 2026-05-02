create type public.automation_trigger_next as enum (
  'new_invoice',
  'new_estimate',
  'review_request',
  'lead_notification',
  'inquiry_response'
);

delete from public.automation_rules
where trigger_event in ('estimate_approved', 'invoice_overdue', 'days_since_job');

update public.automation_rules
set recipient_targets = coalesce(
  (
    select jsonb_agg(email_value)
    from (
      select distinct trim(value) as email_value
      from jsonb_array_elements_text(coalesce(public.automation_rules.recipient_targets, '[]'::jsonb)) as recipient(value)
      where trim(value) ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    ) as valid_emails
  ),
  '[]'::jsonb
);

alter table public.automation_rules
  alter column trigger_event type public.automation_trigger_next
  using (
    case trigger_event::text
      when 'new_lead' then 'lead_notification'
      when 'form_submitted' then 'inquiry_response'
      when 'job_completed' then 'review_request'
      when 'new_estimate' then 'new_estimate'
      when 'new_invoice' then 'new_invoice'
      else null
    end
  )::public.automation_trigger_next;

drop type public.automation_trigger;

alter type public.automation_trigger_next rename to automation_trigger;
