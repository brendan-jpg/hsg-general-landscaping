create table if not exists public.custom_content_types (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  singular_name text not null,
  plural_name text not null,
  base_path text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint custom_content_types_base_path_check check (char_length(trim(base_path)) > 0)
);

create unique index if not exists custom_content_types_business_id_base_path_key
  on public.custom_content_types (business_id, base_path);

create index if not exists custom_content_types_business_id_idx
  on public.custom_content_types (business_id);

drop trigger if exists set_custom_content_types_updated_at on public.custom_content_types;
create trigger set_custom_content_types_updated_at
before update on public.custom_content_types
for each row execute function update_updated_at();

alter table public.custom_content_types enable row level security;

create table if not exists public.custom_content_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  content_type_id uuid not null references public.custom_content_types(id) on delete cascade,
  title text not null,
  slug text not null,
  excerpt text,
  featured_image_url text,
  content jsonb not null default '[]'::jsonb,
  meta_title text,
  meta_description text,
  status text not null default 'draft',
  sort_order integer not null default 0,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint custom_content_entries_status_check check (status in ('draft', 'published'))
);

create unique index if not exists custom_content_entries_type_id_slug_key
  on public.custom_content_entries (content_type_id, slug);

create index if not exists custom_content_entries_business_id_idx
  on public.custom_content_entries (business_id);

create index if not exists custom_content_entries_type_id_idx
  on public.custom_content_entries (content_type_id);

drop trigger if exists set_custom_content_entries_updated_at on public.custom_content_entries;
create trigger set_custom_content_entries_updated_at
before update on public.custom_content_entries
for each row execute function update_updated_at();

alter table public.custom_content_entries enable row level security;
