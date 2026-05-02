update public.forms
set
  name = 'Default Form',
  slug = 'form'
where lower(coalesce(name, '')) = 'default contact form'
   or lower(coalesce(slug, '')) = 'contact-form';
