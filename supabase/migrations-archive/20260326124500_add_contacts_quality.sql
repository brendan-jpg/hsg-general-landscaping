alter table public.contacts
add column if not exists quality text not null default 'new';

update public.contacts
set quality = 'new'
where quality is null or btrim(quality) = '';

alter table public.contacts
drop constraint if exists contacts_quality_check;

alter table public.contacts
add constraint contacts_quality_check
check (quality in ('new', 'qualified', 'nurture', 'hot', 'spam', 'lost'));
