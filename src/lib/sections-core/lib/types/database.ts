export interface BlogPostRecord {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  featured_image_url?: string | null;
  published_at?: string | null;
  created_at: string;
  read_time_minutes?: number | null;
}

export interface ServiceRecord {
  id: string;
  title: string;
  slug: string;
  excerpt?: string | null;
  icon?: string | null;
  featured_image_url?: string | null;
  parent_service_id?: string | null;
  is_primary?: boolean | null;
}

export interface ServiceAreaRecord {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  featured_image_url?: string | null;
}

export interface TeamMemberRecord {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  title?: string | null;
  bio?: string | null;
  photo_url?: string | null;
}

export interface TestimonialRecord {
  id: string;
  content: string;
  rating?: number | null;
  customer_name?: string | null;
  area_id?: string | null;
  service_id?: string | null;
}

export interface DatabaseTables {
  blog_posts: BlogPostRecord;
  services: ServiceRecord;
  service_areas: ServiceAreaRecord;
  team_members: TeamMemberRecord;
  testimonials: TestimonialRecord;
}

export type Tables<T extends keyof DatabaseTables> = DatabaseTables[T];
