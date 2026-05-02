alter table public.automation_rules
add column if not exists recipient_targets jsonb not null default '[]'::jsonb;

update public.automation_rules
set recipient_targets = case trigger_event
  when 'new_lead' then '["admin"]'::jsonb
  when 'estimate_approved' then '["admin"]'::jsonb
  when 'form_submitted' then '["lead"]'::jsonb
  when 'job_completed' then '["customer"]'::jsonb
  when 'new_estimate' then '["prospect"]'::jsonb
  when 'new_invoice' then '["customer"]'::jsonb
  when 'invoice_overdue' then '["customer"]'::jsonb
  when 'days_since_job' then '["customer"]'::jsonb
  else '["admin"]'::jsonb
end
where recipient_targets = '[]'::jsonb;
