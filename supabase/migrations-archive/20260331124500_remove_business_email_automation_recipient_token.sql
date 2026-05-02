update public.automation_rules
set recipient_targets = coalesce(
  (
    select jsonb_agg(recipient_value)
    from (
      select distinct trim(value) as recipient_value
      from jsonb_array_elements_text(coalesce(public.automation_rules.recipient_targets, '[]'::jsonb)) as recipient(value)
      where trim(value) <> 'business_email'
    ) as filtered_recipients
  ),
  '[]'::jsonb
)
where recipient_targets @> '["business_email"]'::jsonb;
