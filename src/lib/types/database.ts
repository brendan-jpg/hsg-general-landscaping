export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          business_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          business_id: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          business_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          business_id: string
          created_at: string
          device_type: string | null
          event_type: Database["public"]["Enums"]["analytics_event_type"]
          id: string
          page_url: string | null
          referrer: string | null
          session_id: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          device_type?: string | null
          event_type: Database["public"]["Enums"]["analytics_event_type"]
          id?: string
          page_url?: string | null
          referrer?: string | null
          session_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          device_type?: string | null
          event_type?: Database["public"]["Enums"]["analytics_event_type"]
          id?: string
          page_url?: string | null
          referrer?: string | null
          session_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          business_id: string
          conditions: Json | null
          created_at: string
          delay_minutes: number
          id: string
          is_active: boolean
          name: string
          recipient_targets: Json | null
          template_id: string
          trigger_event: Database["public"]["Enums"]["automation_trigger"]
          updated_at: string
        }
        Insert: {
          business_id: string
          conditions?: Json | null
          created_at?: string
          delay_minutes?: number
          id?: string
          is_active?: boolean
          name: string
          recipient_targets?: Json | null
          template_id: string
          trigger_event: Database["public"]["Enums"]["automation_trigger"]
          updated_at?: string
        }
        Update: {
          business_id?: string
          conditions?: Json | null
          created_at?: string
          delay_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          recipient_targets?: Json | null
          template_id?: string
          trigger_event?: Database["public"]["Enums"]["automation_trigger"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_rules_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "automation_rules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string | null
          business_id: string
          content: Json
          created_at: string
          excerpt: string | null
          featured_image_url: string | null
          id: string
          is_featured: boolean
          meta_description: string | null
          meta_title: string | null
          published_at: string | null
          read_time_minutes: number | null
          slug: string
          status: Database["public"]["Enums"]["post_status"]
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          business_id: string
          content?: Json
          created_at?: string
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          is_featured?: boolean
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          read_time_minutes?: number | null
          slug: string
          status?: Database["public"]["Enums"]["post_status"]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          business_id?: string
          content?: Json
          created_at?: string
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          is_featured?: boolean
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          read_time_minutes?: number | null
          slug?: string
          status?: Database["public"]["Enums"]["post_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_posts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_posts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
        ]
      }
      blog_post_services: {
        Row: {
          blog_post_id: string
          created_at: string
          service_id: string
        }
        Insert: {
          blog_post_id: string
          created_at?: string
          service_id: string
        }
        Update: {
          blog_post_id?: string
          created_at?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_services_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blog_post_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      quickbooks_connections: {
        Row: {
          access_token: string
          access_token_expires_at: string | null
          business_id: string
          company_name: string | null
          created_at: string
          last_sync_error: string | null
          last_synced_at: string | null
          realm_id: string
          refresh_token: string
          refresh_token_expires_at: string | null
          scope: string | null
          token_type: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          access_token_expires_at?: string | null
          business_id: string
          company_name?: string | null
          created_at?: string
          last_sync_error?: string | null
          last_synced_at?: string | null
          realm_id: string
          refresh_token: string
          refresh_token_expires_at?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          access_token_expires_at?: string | null
          business_id?: string
          company_name?: string | null
          created_at?: string
          last_sync_error?: string | null
          last_synced_at?: string | null
          realm_id?: string
          refresh_token?: string
          refresh_token_expires_at?: string | null
          scope?: string | null
          token_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quickbooks_connections_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quickbooks_connections_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
        ]
      }
      businesses: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          created_at: string
          domain: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          settings: Json
          slug: string
          state: Database["public"]["Enums"]["us_state_code"] | null
          theme_css: string | null
          theme_key: string
          timezone: string
          updated_at: string
          zip: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          created_at?: string
          domain?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          settings?: Json
          slug: string
          state?: Database["public"]["Enums"]["us_state_code"] | null
          theme_css?: string | null
          theme_key: string
          timezone?: string
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          created_at?: string
          domain?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          settings?: Json
          slug?: string
          state?: Database["public"]["Enums"]["us_state_code"] | null
          theme_css?: string | null
          theme_key?: string
          timezone?: string
          updated_at?: string
          zip?: string | null
        }
        Relationships: []
      }
      business_domains: {
        Row: {
          business_id: string
          canonical_domain: string | null
          created_at: string
          domain: string
          id: string
          is_active: boolean
          is_primary: boolean
          updated_at: string
        }
        Insert: {
          business_id: string
          canonical_domain?: string | null
          created_at?: string
          domain: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          updated_at?: string
        }
        Update: {
          business_id?: string
          canonical_domain?: string | null
          created_at?: string
          domain?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_domains_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_domains_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
        ]
      }
      zip_locations: {
        Row: {
          city: string
          county_name: string | null
          created_at: string
          imprecise: boolean
          lat: number
          lng: number
          military: boolean
          population: number | null
          state_id: string
          state_name: string
          timezone: string | null
          updated_at: string
          zip: string
        }
        Insert: {
          city: string
          county_name?: string | null
          created_at?: string
          imprecise?: boolean
          lat: number
          lng: number
          military?: boolean
          population?: number | null
          state_id: string
          state_name: string
          timezone?: string | null
          updated_at?: string
          zip: string
        }
        Update: {
          city?: string
          county_name?: string | null
          created_at?: string
          imprecise?: boolean
          lat?: number
          lng?: number
          military?: boolean
          population?: number | null
          state_id?: string
          state_name?: string
          timezone?: string | null
          updated_at?: string
          zip?: string
        }
        Relationships: []
      }
      contact_properties: {
        Row: {
          contact_id: string
          id: string
          key: string
          value: string | null
        }
        Insert: {
          contact_id: string
          id?: string
          key: string
          value?: string | null
        }
        Update: {
          contact_id?: string
          id?: string
          key?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_properties_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          business_id: string
          city: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          lifetime_value: number
          notes: string | null
          phone: string | null
          quality: string
          qbo_customer_id: string | null
          source_submission_id: string | null
          source: Database["public"]["Enums"]["contact_source"]
          state: string | null
          status: Database["public"]["Enums"]["contact_status"]
          tags: string[] | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          business_id: string
          city?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          lifetime_value?: number
          notes?: string | null
          phone?: string | null
          quality?: string
          qbo_customer_id?: string | null
          source_submission_id?: string | null
          source?: Database["public"]["Enums"]["contact_source"]
          state?: string | null
          status?: Database["public"]["Enums"]["contact_status"]
          tags?: string[] | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          business_id?: string
          city?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          lifetime_value?: number
          notes?: string | null
          phone?: string | null
          quality?: string
          qbo_customer_id?: string | null
          source_submission_id?: string | null
          source?: Database["public"]["Enums"]["contact_source"]
          state?: string | null
          status?: Database["public"]["Enums"]["contact_status"]
          tags?: string[] | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "contacts_source_submission_id_fkey"
            columns: ["source_submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      email_log: {
        Row: {
          business_id: string
          contact_id: string | null
          created_at: string
          id: string
          opened_at: string | null
          related_id: string | null
          related_type: string | null
          resend_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["email_status"]
          subject: string
          template_id: string | null
          to_email: string
        }
        Insert: {
          business_id: string
          contact_id?: string | null
          created_at?: string
          id?: string
          opened_at?: string | null
          related_id?: string | null
          related_type?: string | null
          resend_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject: string
          template_id?: string | null
          to_email: string
        }
        Update: {
          business_id?: string
          contact_id?: string | null
          created_at?: string
          id?: string
          opened_at?: string | null
          related_id?: string | null
          related_type?: string | null
          resend_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string
          template_id?: string | null
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "email_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_log_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string
          body_text: string
          business_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          subject: string
          updated_at: string
        }
        Insert: {
          body_html?: string
          body_text?: string
          business_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          subject: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          body_text?: string
          business_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
        ]
      }
      estimate_approvals: {
        Row: {
          approved_at: string
          business_id: string
          created_at: string
          customer_name: string
          estimate_id: string
          estimate_version: number
          id: string
          ip_address: string | null
          user_agent: string | null
        }
        Insert: {
          approved_at?: string
          business_id: string
          created_at?: string
          customer_name: string
          estimate_id: string
          estimate_version?: number
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Update: {
          approved_at?: string
          business_id?: string
          created_at?: string
          customer_name?: string
          estimate_id?: string
          estimate_version?: number
          id?: string
          ip_address?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimate_approvals_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimate_approvals_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "estimate_approvals_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          approval_token: string | null
          approved_at: string | null
          business_id: string
          contact_id: string
          created_at: string
          estimate_number: string
          estimate_version: number
          id: string
          job_id: string | null
          line_items: Json
          notes: string | null
          qbo_estimate_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["estimate_status"]
          subtotal: number
          tax: number
          tax_rate: number
          total: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          approval_token?: string | null
          approved_at?: string | null
          business_id: string
          contact_id: string
          created_at?: string
          estimate_number: string
          estimate_version?: number
          id?: string
          job_id?: string | null
          line_items?: Json
          notes?: string | null
          qbo_estimate_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["estimate_status"]
          subtotal?: number
          tax?: number
          tax_rate?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          approval_token?: string | null
          approved_at?: string | null
          business_id?: string
          contact_id?: string
          created_at?: string
          estimate_number?: string
          estimate_version?: number
          id?: string
          job_id?: string | null
          line_items?: Json
          notes?: string | null
          qbo_estimate_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["estimate_status"]
          subtotal?: number
          tax?: number
          tax_rate?: number
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "estimates_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "upcoming_schedule"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_services: {
        Row: {
          created_at: string
          faq_id: string
          service_id: string
        }
        Insert: {
          created_at?: string
          faq_id: string
          service_id: string
        }
        Update: {
          created_at?: string
          faq_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "faq_services_faq_id_fkey"
            columns: ["faq_id"]
            isOneToOne: false
            referencedRelation: "faqs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faq_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      faqs: {
        Row: {
          answer: string
          business_id: string
          created_at: string
          id: string
          is_global: boolean
          page_id: string | null
          page_type: string | null
          question: string
          schema_markup: boolean
          updated_at: string
        }
        Insert: {
          answer: string
          business_id: string
          created_at?: string
          id?: string
          is_global?: boolean
          page_id?: string | null
          page_type?: string | null
          question: string
          schema_markup?: boolean
          updated_at?: string
        }
        Update: {
          answer?: string
          business_id?: string
          created_at?: string
          id?: string
          is_global?: boolean
          page_id?: string | null
          page_type?: string | null
          question?: string
          schema_markup?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "faqs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faqs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          business_id: string
          contact_id: string | null
          created_at: string
          data: Json
          form_type: Database["public"]["Enums"]["form_type"]
          id: string
          ip_address: string | null
          page_url: string | null
          status: Database["public"]["Enums"]["form_submission_status"]
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          business_id: string
          contact_id?: string | null
          created_at?: string
          data?: Json
          form_type?: Database["public"]["Enums"]["form_type"]
          id?: string
          ip_address?: string | null
          page_url?: string | null
          status?: Database["public"]["Enums"]["form_submission_status"]
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          business_id?: string
          contact_id?: string | null
          created_at?: string
          data?: Json
          form_type?: Database["public"]["Enums"]["form_type"]
          id?: string
          ip_address?: string | null
          page_url?: string | null
          status?: Database["public"]["Enums"]["form_submission_status"]
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "form_submissions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          auto_response_template_id: string | null
          business_id: string
          created_at: string
          description: string | null
          fields: Json
          id: string
          is_active: boolean
          name: string
          slug: string
          thank_you_message: string | null
          updated_at: string
        }
        Insert: {
          auto_response_template_id?: string | null
          business_id: string
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean
          name: string
          slug: string
          thank_you_message?: string | null
          updated_at?: string
        }
        Update: {
          auto_response_template_id?: string | null
          business_id?: string
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          thank_you_message?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forms_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forms_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "forms_auto_response_template_id_fkey"
            columns: ["auto_response_template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          business_id: string
          contact_id: string
          created_at: string
          due_date: string | null
          estimate_id: string | null
          id: string
          invoice_number: string
          job_id: string | null
          line_items: Json
          notes: string | null
          paid_at: string | null
          qbo_invoice_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax: number
          tax_rate: number
          total: number
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          business_id: string
          contact_id: string
          created_at?: string
          due_date?: string | null
          estimate_id?: string | null
          id?: string
          invoice_number: string
          job_id?: string | null
          line_items?: Json
          notes?: string | null
          paid_at?: string | null
          qbo_invoice_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax?: number
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          business_id?: string
          contact_id?: string
          created_at?: string
          due_date?: string | null
          estimate_id?: string | null
          id?: string
          invoice_number?: string
          job_id?: string | null
          line_items?: Json
          notes?: string | null
          paid_at?: string | null
          qbo_invoice_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax?: number
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "invoices_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_estimate_id_fkey"
            columns: ["estimate_id"]
            isOneToOne: false
            referencedRelation: "estimates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "upcoming_schedule"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          actual_end: string | null
          actual_start: string | null
          address_line1: string | null
          address_line2: string | null
          assigned_team_member_id: string | null
          assigned_to: string | null
          business_id: string
          city: string | null
          contact_id: string
          created_at: string
          description: string | null
          id: string
          internal_notes: string | null
          priority: Database["public"]["Enums"]["job_priority"]
          scheduled_end: string | null
          scheduled_start: string | null
          service_id: string | null
          state: string | null
          status: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at: string
          zip: string | null
        }
        Insert: {
          actual_end?: string | null
          actual_start?: string | null
          address_line1?: string | null
          address_line2?: string | null
          assigned_team_member_id?: string | null
          assigned_to?: string | null
          business_id: string
          city?: string | null
          contact_id: string
          created_at?: string
          description?: string | null
          id?: string
          internal_notes?: string | null
          priority?: Database["public"]["Enums"]["job_priority"]
          scheduled_end?: string | null
          scheduled_start?: string | null
          service_id?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at?: string
          zip?: string | null
        }
        Update: {
          actual_end?: string | null
          actual_start?: string | null
          address_line1?: string | null
          address_line2?: string | null
          assigned_team_member_id?: string | null
          assigned_to?: string | null
          business_id?: string
          city?: string | null
          contact_id?: string
          created_at?: string
          description?: string | null
          id?: string
          internal_notes?: string | null
          priority?: Database["public"]["Enums"]["job_priority"]
          scheduled_end?: string | null
          scheduled_start?: string | null
          service_id?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_assigned_team_member_id_fkey"
            columns: ["assigned_team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "jobs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      job_team_members: {
        Row: {
          business_id: string
          created_at: string
          hours_worked: number | null
          id: string
          job_id: string
          team_member_id: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          hours_worked?: number | null
          id?: string
          job_id: string
          team_member_id: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          hours_worked?: number | null
          id?: string
          job_id?: string
          team_member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_team_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_team_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "job_team_members_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_team_members_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "upcoming_schedule"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_team_members_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          alt_text: string | null
          blur_data_url: string | null
          business_id: string
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          folder: string | null
          height: number | null
          id: string
          metadata: Json | null
          original_file_url: string | null
          storage_prefix: string | null
          uploaded_by: string | null
          variants: Json | null
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          blur_data_url?: string | null
          business_id: string
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          folder?: string | null
          height?: number | null
          id?: string
          metadata?: Json | null
          original_file_url?: string | null
          storage_prefix?: string | null
          uploaded_by?: string | null
          variants?: Json | null
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          blur_data_url?: string | null
          business_id?: string
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          folder?: string | null
          height?: number | null
          id?: string
          metadata?: Json | null
          original_file_url?: string | null
          storage_prefix?: string | null
          uploaded_by?: string | null
          variants?: Json | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "media_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      navigation_menus: {
        Row: {
          business_id: string
          id: string
          items: Json
          location: Database["public"]["Enums"]["menu_location"]
          updated_at: string
        }
        Insert: {
          business_id: string
          id?: string
          items?: Json
          location: Database["public"]["Enums"]["menu_location"]
          updated_at?: string
        }
        Update: {
          business_id?: string
          id?: string
          items?: Json
          location?: Database["public"]["Enums"]["menu_location"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "navigation_menus_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "navigation_menus_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
        ]
      }
      pages: {
        Row: {
          business_id: string
          content: Json
          created_at: string
          id: string
          is_active: boolean
          meta_description: string | null
          meta_title: string | null
          og_image_url: string | null
          page_kind: string | null
          show_in_nav: boolean
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          business_id: string
          content?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          page_kind?: string | null
          show_in_nav?: boolean
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          content?: Json
          created_at?: string
          id?: string
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          page_kind?: string | null
          show_in_nav?: boolean
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          business_id: string
          created_at: string
          id: string
          invoice_id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          paid_at: string
          qbo_payment_id: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          business_id: string
          created_at?: string
          id?: string
          invoice_id: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_at?: string
          qbo_payment_id?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string
          id?: string
          invoice_id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_at?: string
          qbo_payment_id?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          business_id: string
          created_at: string
          first_name: string | null
          id: string
          is_active: boolean
          last_name: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          business_id: string
          created_at?: string
          first_name?: string | null
          id: string
          is_active?: boolean
          last_name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          business_id?: string
          created_at?: string
          first_name?: string | null
          id?: string
          is_active?: boolean
          last_name?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
        ]
      }
      project_services: {
        Row: {
          created_at: string
          project_id: string
          service_id: string
        }
        Insert: {
          created_at?: string
          project_id: string
          service_id: string
        }
        Update: {
          created_at?: string
          project_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_services_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          business_id: string
          created_at: string
          gallery_urls: string[]
          id: string
          location: string | null
          project_date: string | null
          review: string | null
          slug: string
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          gallery_urls?: string[]
          id?: string
          location?: string | null
          project_date?: string | null
          review?: string | null
          slug: string
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          gallery_urls?: string[]
          id?: string
          location?: string | null
          project_date?: string | null
          review?: string | null
          slug?: string
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
        ]
      }
      redirects: {
        Row: {
          business_id: string
          created_at: string
          from_path: string
          id: string
          is_active: boolean
          to_path: string
          type: Database["public"]["Enums"]["redirect_type"]
        }
        Insert: {
          business_id: string
          created_at?: string
          from_path: string
          id?: string
          is_active?: boolean
          to_path: string
          type?: Database["public"]["Enums"]["redirect_type"]
        }
        Update: {
          business_id?: string
          created_at?: string
          from_path?: string
          id?: string
          is_active?: boolean
          to_path?: string
          type?: Database["public"]["Enums"]["redirect_type"]
        }
        Relationships: [
          {
            foreignKeyName: "redirects_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "redirects_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
        ]
      }
      schedule_items: {
        Row: {
          assigned_team_member_id: string | null
          assigned_to: string | null
          business_id: string
          created_at: string
          description: string | null
          ends_at: string | null
          id: string
          location: string | null
          related_job_id: string | null
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_team_member_id?: string | null
          assigned_to?: string | null
          business_id: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          related_job_id?: string | null
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_team_member_id?: string | null
          assigned_to?: string | null
          business_id?: string
          created_at?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          location?: string | null
          related_job_id?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_items_assigned_team_member_id_fkey"
            columns: ["assigned_team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_items_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "schedule_items_related_job_id_fkey"
            columns: ["related_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_items_related_job_id_fkey"
            columns: ["related_job_id"]
            isOneToOne: false
            referencedRelation: "upcoming_schedule"
            referencedColumns: ["id"]
          },
        ]
      }
      scheduled_emails: {
        Row: {
          automation_rule_id: string
          contact_id: string
          created_at: string
          id: string
          related_id: string | null
          related_type: string | null
          scheduled_for: string
          sent_at: string | null
          status: Database["public"]["Enums"]["scheduled_email_status"]
        }
        Insert: {
          automation_rule_id: string
          contact_id: string
          created_at?: string
          id?: string
          related_id?: string | null
          related_type?: string | null
          scheduled_for: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["scheduled_email_status"]
        }
        Update: {
          automation_rule_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          related_id?: string | null
          related_type?: string | null
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["scheduled_email_status"]
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_emails_automation_rule_id_fkey"
            columns: ["automation_rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scheduled_emails_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_settings: {
        Row: {
          business_id: string
          created_at: string
          default_meta_title_suffix: string | null
          google_analytics_id: string | null
          google_business_profile_url: string | null
          google_tag_manager_id: string | null
          id: string
          og_image_url: string | null
          sitemap_excludes: string[] | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          default_meta_title_suffix?: string | null
          google_analytics_id?: string | null
          google_business_profile_url?: string | null
          google_tag_manager_id?: string | null
          id?: string
          og_image_url?: string | null
          sitemap_excludes?: string[] | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          default_meta_title_suffix?: string | null
          google_analytics_id?: string | null
          google_business_profile_url?: string | null
          google_tag_manager_id?: string | null
          id?: string
          og_image_url?: string | null
          sitemap_excludes?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seo_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
        ]
      }
      areas: {
        Row: {
          business_id: string
          content: Json
          created_at: string
          featured_image_url: string | null
          id: string
          icon: string | null
          is_active: boolean
          meta_description: string | null
          meta_title: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          business_id: string
          content?: Json
          created_at?: string
          featured_image_url?: string | null
          id?: string
          icon?: string | null
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          content?: Json
          created_at?: string
          featured_image_url?: string | null
          id?: string
          icon?: string | null
          is_active?: boolean
          meta_description?: string | null
          meta_title?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "areas_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "areas_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
        ]
      }
        services: {
          Row: {
            before_after_groups: Json
            business_id: string
          content: Json
          created_at: string
          excerpt: string | null
          featured_image_url: string | null
          icon: string | null
          id: string
          is_active: boolean
          is_primary: boolean
          meta_description: string | null
          meta_title: string | null
          parent_service_id: string | null
          service_gallery_urls: string[]
          service_projects: Json
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
          Insert: {
            before_after_groups?: Json
            business_id: string
          content?: Json
          created_at?: string
          excerpt?: string | null
          featured_image_url?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_primary?: boolean
          meta_description?: string | null
          meta_title?: string | null
          parent_service_id?: string | null
          service_gallery_urls?: string[]
          service_projects?: Json
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
          Update: {
            before_after_groups?: Json
            business_id?: string
          content?: Json
          created_at?: string
          excerpt?: string | null
          featured_image_url?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_primary?: boolean
          meta_description?: string | null
          meta_title?: string | null
          parent_service_id?: string | null
          service_gallery_urls?: string[]
          service_projects?: Json
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "services_parent_service_id_fkey"
            columns: ["parent_service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      team_member_employment: {
        Row: {
          app_role: Database["public"]["Enums"]["user_role"]
          business_id: string
          created_at: string
          employment_status: string
          end_date: string | null
          hourly_rate: number | null
          id: string
          internal_notes: string | null
          invited_at: string | null
          login_email: string | null
          login_status: string
          pay_type: string
          phone: string | null
          profile_id: string | null
          salary_amount: number | null
          start_date: string | null
          team_member_id: string
          updated_at: string
        }
        Insert: {
          app_role?: Database["public"]["Enums"]["user_role"]
          business_id: string
          created_at?: string
          employment_status?: string
          end_date?: string | null
          hourly_rate?: number | null
          id?: string
          internal_notes?: string | null
          invited_at?: string | null
          login_email?: string | null
          login_status?: string
          pay_type?: string
          phone?: string | null
          profile_id?: string | null
          salary_amount?: number | null
          start_date?: string | null
          team_member_id: string
          updated_at?: string
        }
        Update: {
          app_role?: Database["public"]["Enums"]["user_role"]
          business_id?: string
          created_at?: string
          employment_status?: string
          end_date?: string | null
          hourly_rate?: number | null
          id?: string
          internal_notes?: string | null
          invited_at?: string | null
          login_email?: string | null
          login_status?: string
          pay_type?: string
          phone?: string | null
          profile_id?: string | null
          salary_amount?: number | null
          start_date?: string | null
          team_member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_member_employment_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_member_employment_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "team_member_employment_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_member_employment_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: true
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          bio: string | null
          business_id: string
          created_at: string
          first_name: string | null
          id: string
          last_name: string | null
          photo_url: string | null
          sort_order: number
          title: string | null
          updated_at: string
          website_published: boolean
        }
        Insert: {
          bio?: string | null
          business_id: string
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          photo_url?: string | null
          sort_order?: number
          title?: string | null
          updated_at?: string
          website_published?: boolean
        }
        Update: {
          bio?: string | null
          business_id?: string
          created_at?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          photo_url?: string | null
          sort_order?: number
          title?: string | null
          updated_at?: string
          website_published?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "team_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
        ]
      }
      testimonials: {
        Row: {
          area_id: string | null
          avatar_url: string | null
          business_id: string
          content: string
          created_at: string
          customer_name: string
          id: string
          is_active: boolean
          is_featured: boolean
          rating: number | null
          review_date: string | null
          service_id: string | null
          source: Database["public"]["Enums"]["testimonial_source"]
          source_url: string | null
        }
        Insert: {
          area_id?: string | null
          avatar_url?: string | null
          business_id: string
          content: string
          created_at?: string
          customer_name: string
          id?: string
          is_active?: boolean
          is_featured?: boolean
          rating?: number | null
          review_date?: string | null
          service_id?: string | null
          source?: Database["public"]["Enums"]["testimonial_source"]
          source_url?: string | null
        }
        Update: {
          area_id?: string | null
          avatar_url?: string | null
          business_id?: string
          content?: string
          created_at?: string
          customer_name?: string
          id?: string
          is_active?: boolean
          is_featured?: boolean
          rating?: number | null
          review_date?: string | null
          service_id?: string | null
          source?: Database["public"]["Enums"]["testimonial_source"]
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "testimonials_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testimonials_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "testimonials_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "testimonials_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      user_business_access: {
        Row: {
          business_id: string
          created_at: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_business_access_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_business_access_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
          {
            foreignKeyName: "user_business_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      dashboard_stats: {
        Row: {
          active_jobs: number | null
          business_id: string | null
          jobs_this_week: number | null
          open_leads: number | null
          overdue_amount: number | null
          overdue_invoices: number | null
          revenue_this_month: number | null
          revenue_this_year: number | null
          unread_submissions: number | null
        }
        Insert: {
          active_jobs?: never
          business_id?: string | null
          jobs_this_week?: never
          open_leads?: never
          overdue_amount?: never
          overdue_invoices?: never
          revenue_this_month?: never
          revenue_this_year?: never
          unread_submissions?: never
        }
        Update: {
          active_jobs?: never
          business_id?: string | null
          jobs_this_week?: never
          open_leads?: never
          overdue_amount?: never
          overdue_invoices?: never
          revenue_this_month?: never
          revenue_this_year?: never
          unread_submissions?: never
        }
        Relationships: []
      }
      upcoming_schedule: {
        Row: {
          address_line1: string | null
          assigned_to_name: string | null
          business_id: string | null
          city: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string | null
          priority: Database["public"]["Enums"]["job_priority"] | null
          scheduled_end: string | null
          scheduled_start: string | null
          service_name: string | null
          state: string | null
          status: Database["public"]["Enums"]["job_status"] | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "dashboard_stats"
            referencedColumns: ["business_id"]
          },
        ]
      }
    }
    Functions: {
      get_my_business_id: { Args: never; Returns: string }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      analytics_event_type:
        | "page_view"
        | "form_start"
        | "form_submit"
        | "cta_click"
        | "phone_click"
      automation_trigger:
        | "new_invoice"
        | "new_estimate"
        | "review_request"
        | "lead_notification"
        | "inquiry_response"
      contact_source:
        | "website_form"
        | "phone"
        | "referral"
        | "google"
        | "manual"
        | "other"
      contact_status: "lead" | "prospect" | "customer" | "inactive"
      email_status:
        | "queued"
        | "sent"
        | "delivered"
        | "opened"
        | "clicked"
        | "bounced"
        | "failed"
      estimate_status:
        | "draft"
        | "sent"
        | "viewed"
        | "approved"
        | "declined"
        | "expired"
      form_submission_status: "new" | "read" | "responded" | "spam"
      form_type: "contact" | "quote_request" | "booking" | "newsletter"
      invoice_status: "draft" | "sent" | "viewed" | "paid" | "overdue" | "void"
      job_priority: "low" | "normal" | "high" | "urgent"
      job_status: "scheduled" | "in_progress" | "completed" | "canceled"
      menu_location: "header" | "footer" | "sidebar"
      payment_method:
        | "cash"
        | "check"
        | "credit_card"
        | "bank_transfer"
        | "other"
      post_status: "draft" | "published" | "scheduled" | "archived"
      redirect_type: "301" | "302"
      scheduled_email_status: "pending" | "sent" | "cancelled"
      testimonial_source: "google" | "yelp" | "facebook" | "manual"
      user_role: "admin" | "employee"
      us_state_code:
        | "AL"
        | "AK"
        | "AZ"
        | "AR"
        | "CA"
        | "CO"
        | "CT"
        | "DE"
        | "FL"
        | "GA"
        | "HI"
        | "ID"
        | "IL"
        | "IN"
        | "IA"
        | "KS"
        | "KY"
        | "LA"
        | "ME"
        | "MD"
        | "MA"
        | "MI"
        | "MN"
        | "MS"
        | "MO"
        | "MT"
        | "NE"
        | "NV"
        | "NH"
        | "NJ"
        | "NM"
        | "NY"
        | "NC"
        | "ND"
        | "OH"
        | "OK"
        | "OR"
        | "PA"
        | "RI"
        | "SC"
        | "SD"
        | "TN"
        | "TX"
        | "UT"
        | "VT"
        | "VA"
        | "WA"
        | "WV"
        | "WI"
        | "WY"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      analytics_event_type: [
        "page_view",
        "form_start",
        "form_submit",
        "cta_click",
        "phone_click",
      ],
      automation_trigger: [
        "new_invoice",
        "new_estimate",
        "review_request",
        "lead_notification",
        "inquiry_response",
      ],
      contact_source: [
        "website_form",
        "phone",
        "referral",
        "google",
        "manual",
        "other",
      ],
      contact_status: ["lead", "prospect", "customer", "inactive"],
      email_status: [
        "queued",
        "sent",
        "delivered",
        "opened",
        "clicked",
        "bounced",
        "failed",
      ],
      estimate_status: [
        "draft",
        "sent",
        "viewed",
        "approved",
        "declined",
        "expired",
      ],
      form_submission_status: ["new", "read", "responded", "spam"],
      form_type: ["contact", "quote_request", "booking", "newsletter"],
      invoice_status: ["draft", "sent", "viewed", "paid", "overdue", "void"],
      job_priority: ["low", "normal", "high", "urgent"],
      job_status: ["scheduled", "in_progress", "completed", "canceled"],
      menu_location: ["header", "footer", "sidebar"],
      payment_method: [
        "cash",
        "check",
        "credit_card",
        "bank_transfer",
        "other",
      ],
      post_status: ["draft", "published", "scheduled", "archived"],
      redirect_type: ["301", "302"],
      scheduled_email_status: ["pending", "sent", "cancelled"],
      testimonial_source: ["google", "yelp", "facebook", "manual"],
      user_role: ["admin", "employee"],
    },
  },
} as const
