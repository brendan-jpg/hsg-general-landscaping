create index if not exists testimonials_google_source_lookup_idx
  on public.testimonials (business_id, source, source_url);
