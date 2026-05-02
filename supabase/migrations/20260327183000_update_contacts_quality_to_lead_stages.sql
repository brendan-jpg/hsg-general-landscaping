update contacts
set quality = case
  when quality = 'qualified' then 'contacted'
  when quality = 'hot' then 'contacted'
  when quality = 'nurture' then 'attempted'
  else quality
end
where quality in ('qualified', 'hot', 'nurture');

alter table contacts
drop constraint if exists contacts_quality_check;

alter table contacts
add constraint contacts_quality_check
check (quality in ('new', 'attempted', 'contacted', 'unqualified', 'lost', 'spam'));
