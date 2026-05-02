import type { Tables } from './database';

// ---- Block content ----
export interface Block {
  type: 'heading' | 'paragraph' | 'image' | 'cta' | 'list' | 'quote' | 'video' | 'html';
  data: Record<string, unknown>;
}

export interface HeadingBlock extends Block {
  type: 'heading';
  data: { text: string; level: 1 | 2 | 3 | 4 | 5 | 6 };
}

export interface ParagraphBlock extends Block {
  type: 'paragraph';
  data: { text: string };
}

export interface ImageBlock extends Block {
  type: 'image';
  data: { media_id: string; url: string; alt: string; caption?: string };
}

export interface CtaBlock extends Block {
  type: 'cta';
  data: { text: string; url: string; style: 'primary' | 'secondary' };
}

export interface ListBlock extends Block {
  type: 'list';
  data: { items: string[]; ordered: boolean };
}

export interface QuoteBlock extends Block {
  type: 'quote';
  data: { text: string; attribution?: string };
}

// ---- Line items (estimates & invoices) ----
export interface LineItem {
  description: string;
  qty: number;
  unit_price: number;
  total: number;
  qbo_item_id?: string | null;
  qbo_item_name?: string | null;
}

// ---- Nav menu items ----
export interface NavMenuItem {
  label: string;
  url: string;
  children?: NavMenuItem[];
}

// ---- Table row aliases ----
export type Business = Tables<'businesses'>;
export type Profile = Tables<'profiles'>;
export type Page = Tables<'pages'>;
export type Service = Tables<'services'>;
export type Area = Tables<'areas'>;
export type BlogPost = Tables<'blog_posts'>;
export type TeamMember = Tables<'team_members'>;
export type TeamMemberEmployment = Tables<'team_member_employment'>;
export type Media = Tables<'media'>;
export type Testimonial = Tables<'testimonials'>;
export type Faq = Tables<'faqs'>;
export type FaqService = Tables<'faq_services'>;
export type Contact = Tables<'contacts'>;
export type Project = Tables<'projects'>;
export type ProjectService = Tables<'project_services'>;
export type FormSubmission = Tables<'form_submissions'>;
export type Job = Tables<'jobs'>;
export type Estimate = Tables<'estimates'>;
export type Invoice = Tables<'invoices'>;
export type Payment = Tables<'payments'>;
export type EmailTemplate = Tables<'email_templates'>;
export type EmailLog = Tables<'email_log'>;
export type AutomationRule = Tables<'automation_rules'>;
export type ScheduledEmail = Tables<'scheduled_emails'>;
export type ActivityLog = Tables<'activity_log'>;
export type AnalyticsEvent = Tables<'analytics_events'>;
export type SeoSettings = Tables<'seo_settings'>;
export type NavigationMenu = Tables<'navigation_menus'>;
export type Redirect = Tables<'redirects'>;

// ---- View aliases ----
export type DashboardStats = Tables<"dashboard_stats">;
export type UpcomingSchedule = Tables<"upcoming_schedule">;
