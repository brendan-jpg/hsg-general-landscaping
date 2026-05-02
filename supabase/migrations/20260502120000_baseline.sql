--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: analytics_event_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.analytics_event_type AS ENUM (
    'page_view',
    'form_start',
    'form_submit',
    'cta_click',
    'phone_click'
);


--
-- Name: automation_trigger; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.automation_trigger AS ENUM (
    'new_invoice',
    'new_estimate',
    'review_request',
    'lead_notification',
    'inquiry_response'
);


--
-- Name: contact_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.contact_source AS ENUM (
    'website_form',
    'phone',
    'referral',
    'google',
    'manual',
    'other'
);


--
-- Name: contact_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.contact_status AS ENUM (
    'lead',
    'prospect',
    'customer',
    'inactive'
);


--
-- Name: email_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.email_status AS ENUM (
    'queued',
    'sent',
    'delivered',
    'opened',
    'clicked',
    'bounced',
    'failed'
);


--
-- Name: estimate_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estimate_status AS ENUM (
    'draft',
    'sent',
    'viewed',
    'approved',
    'declined',
    'expired'
);


--
-- Name: form_submission_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.form_submission_status AS ENUM (
    'new',
    'read',
    'responded',
    'spam'
);


--
-- Name: form_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.form_type AS ENUM (
    'contact',
    'quote_request',
    'booking',
    'newsletter'
);


--
-- Name: invoice_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.invoice_status AS ENUM (
    'draft',
    'sent',
    'viewed',
    'paid',
    'overdue',
    'void'
);


--
-- Name: job_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.job_priority AS ENUM (
    'low',
    'normal',
    'high',
    'urgent'
);


--
-- Name: job_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.job_status AS ENUM (
    'scheduled',
    'in_progress',
    'completed',
    'canceled'
);


--
-- Name: menu_location; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.menu_location AS ENUM (
    'header',
    'footer',
    'sidebar'
);


--
-- Name: payment_method; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_method AS ENUM (
    'cash',
    'check',
    'credit_card',
    'bank_transfer',
    'other'
);


--
-- Name: post_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.post_status AS ENUM (
    'draft',
    'published',
    'scheduled',
    'archived'
);


--
-- Name: redirect_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.redirect_type AS ENUM (
    '301',
    '302'
);


--
-- Name: scheduled_email_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.scheduled_email_status AS ENUM (
    'pending',
    'sent',
    'cancelled'
);


--
-- Name: testimonial_source; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.testimonial_source AS ENUM (
    'google',
    'yelp',
    'facebook',
    'manual'
);


--
-- Name: us_state_code; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.us_state_code AS ENUM (
    'AL',
    'AK',
    'AZ',
    'AR',
    'CA',
    'CO',
    'CT',
    'DE',
    'FL',
    'GA',
    'HI',
    'ID',
    'IL',
    'IN',
    'IA',
    'KS',
    'KY',
    'LA',
    'ME',
    'MD',
    'MA',
    'MI',
    'MN',
    'MS',
    'MO',
    'MT',
    'NE',
    'NV',
    'NH',
    'NJ',
    'NM',
    'NY',
    'NC',
    'ND',
    'OH',
    'OK',
    'OR',
    'PA',
    'RI',
    'SC',
    'SD',
    'TN',
    'TX',
    'UT',
    'VT',
    'VA',
    'WA',
    'WV',
    'WI',
    'WY'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'employee'
);


--
-- Name: current_user_has_business_access(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_has_business_access(target_business_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.user_business_access uba
    where uba.user_id = auth.uid()
      and uba.business_id = target_business_id
      and uba.is_active = true
  );
$$;


--
-- Name: generate_estimate_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_estimate_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  next_num INT;
BEGIN
  IF NEW.estimate_number IS NULL OR NEW.estimate_number = '' THEN
    SELECT COALESCE(MAX(
      CAST(NULLIF(regexp_replace(estimate_number, '[^0-9]', '', 'g'), '') AS INT)
    ), 0) + 1
    INTO next_num
    FROM estimates
    WHERE business_id = NEW.business_id;

    NEW.estimate_number := 'EST-' || LPAD(next_num::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: generate_invoice_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_invoice_number() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  next_num INT;
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    SELECT COALESCE(MAX(
      CAST(NULLIF(regexp_replace(invoice_number, '[^0-9]', '', 'g'), '') AS INT)
    ), 0) + 1
    INTO next_num
    FROM invoices
    WHERE business_id = NEW.business_id;

    NEW.invoice_number := 'INV-' || LPAD(next_num::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: get_my_business_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_my_business_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT business_id FROM profiles WHERE id = auth.uid();
$$;


--
-- Name: grant_platform_admin_access_for_new_business(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.grant_platform_admin_access_for_new_business() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.user_business_access (user_id, business_id, role, is_active)
  select
    p.id,
    new.id,
    'admin'::public.user_role,
    true
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(coalesce(u.email, '')) = 'support@hsgrowth.com'
  on conflict (user_id, business_id)
  do update set
    role = 'admin'::public.user_role,
    is_active = true,
    updated_at = now();

  return new;
end;
$$;


--
-- Name: normalize_business_domains_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_business_domains_fields() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.domain := lower(trim(new.domain));
  if new.canonical_domain is not null then
    new.canonical_domain := nullif(lower(trim(new.canonical_domain)), '');
  end if;
  new.updated_at := now();
  return new;
end;
$$;


--
-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


--
-- Name: set_published_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_published_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.status = 'published' AND (OLD.status IS DISTINCT FROM 'published') THEN
    IF NEW.published_at IS NULL THEN
      NEW.published_at = NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: update_contact_lifetime_value(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_contact_lifetime_value() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE contacts
  SET lifetime_value = (
    SELECT COALESCE(SUM(p.amount), 0)
    FROM payments p
    JOIN invoices i ON i.id = p.invoice_id
    WHERE i.contact_id = (
      SELECT contact_id FROM invoices WHERE id = NEW.invoice_id
    )
  )
  WHERE id = (
    SELECT contact_id FROM invoices WHERE id = NEW.invoice_id
  );
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_log (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    user_id uuid,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: analytics_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_events (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    session_id text,
    event_type public.analytics_event_type NOT NULL,
    page_url text,
    referrer text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    device_type text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: areas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.areas (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    content jsonb DEFAULT '[]'::jsonb NOT NULL,
    meta_title text,
    meta_description text,
    featured_image_url text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    icon text
);


--
-- Name: automation_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_rules (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    trigger_event public.automation_trigger NOT NULL,
    delay_minutes integer DEFAULT 0 NOT NULL,
    template_id uuid NOT NULL,
    conditions jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    recipient_targets jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: blog_post_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blog_post_services (
    blog_post_id uuid NOT NULL,
    service_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: blog_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blog_posts (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    author_id uuid,
    title text NOT NULL,
    slug text NOT NULL,
    excerpt text,
    content jsonb DEFAULT '[]'::jsonb NOT NULL,
    featured_image_url text,
    meta_title text,
    meta_description text,
    status public.post_status DEFAULT 'draft'::public.post_status NOT NULL,
    published_at timestamp with time zone,
    is_featured boolean DEFAULT false NOT NULL,
    read_time_minutes integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: business_domains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.business_domains (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    domain text NOT NULL,
    canonical_domain text,
    is_primary boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT business_domains_domain_not_blank CHECK ((length(TRIM(BOTH FROM domain)) > 0))
);


--
-- Name: businesses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.businesses (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    domain text,
    logo_url text,
    phone text,
    email text,
    address_line1 text,
    address_line2 text,
    city text,
    state public.us_state_code,
    zip text,
    timezone text DEFAULT 'America/New_York'::text NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    theme_key text NOT NULL,
    theme_css text
);


--
-- Name: contact_properties; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_properties (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    contact_id uuid NOT NULL,
    key text NOT NULL,
    value text
);


--
-- Name: contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    first_name text,
    last_name text,
    email text,
    phone text,
    address_line1 text,
    address_line2 text,
    city text,
    state text,
    zip text,
    source public.contact_source DEFAULT 'manual'::public.contact_source NOT NULL,
    status public.contact_status DEFAULT 'lead'::public.contact_status NOT NULL,
    notes text,
    tags text[] DEFAULT '{}'::text[],
    lifetime_value numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    qbo_customer_id text,
    quality text DEFAULT 'new'::text NOT NULL,
    source_submission_id uuid,
    CONSTRAINT contacts_quality_check CHECK ((quality = ANY (ARRAY['new'::text, 'attempted'::text, 'contacted'::text, 'unqualified'::text, 'lost'::text, 'spam'::text])))
);


--
-- Name: form_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.form_submissions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    contact_id uuid,
    form_type public.form_type DEFAULT 'contact'::public.form_type NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    page_url text,
    utm_source text,
    utm_medium text,
    utm_campaign text,
    ip_address text,
    status public.form_submission_status DEFAULT 'new'::public.form_submission_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    job_id uuid,
    contact_id uuid NOT NULL,
    estimate_id uuid,
    invoice_number text NOT NULL,
    status public.invoice_status DEFAULT 'draft'::public.invoice_status NOT NULL,
    line_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    tax_rate numeric(5,4) DEFAULT 0 NOT NULL,
    tax numeric(12,2) DEFAULT 0 NOT NULL,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    amount_paid numeric(12,2) DEFAULT 0 NOT NULL,
    notes text,
    due_date date,
    sent_at timestamp with time zone,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    qbo_invoice_id text
);


--
-- Name: jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    status public.job_status DEFAULT 'scheduled'::public.job_status NOT NULL,
    service_id uuid,
    assigned_to uuid,
    scheduled_start timestamp with time zone,
    scheduled_end timestamp with time zone,
    actual_start timestamp with time zone,
    actual_end timestamp with time zone,
    address_line1 text,
    address_line2 text,
    city text,
    state text,
    zip text,
    priority public.job_priority DEFAULT 'normal'::public.job_priority NOT NULL,
    internal_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_team_member_id uuid
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    invoice_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    method public.payment_method DEFAULT 'other'::public.payment_method NOT NULL,
    reference text,
    notes text,
    paid_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    qbo_payment_id text
);


--
-- Name: dashboard_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.dashboard_stats AS
 SELECT id AS business_id,
    ( SELECT count(*) AS count
           FROM public.jobs j
          WHERE ((j.business_id = b.id) AND (j.status = ANY (ARRAY['scheduled'::public.job_status, 'in_progress'::public.job_status])))) AS active_jobs,
    ( SELECT count(*) AS count
           FROM public.jobs j
          WHERE ((j.business_id = b.id) AND (j.status = 'scheduled'::public.job_status) AND (j.scheduled_start >= now()) AND (j.scheduled_start < (now() + '7 days'::interval)))) AS jobs_this_week,
    ( SELECT count(*) AS count
           FROM public.contacts c
          WHERE ((c.business_id = b.id) AND (c.status = 'lead'::public.contact_status))) AS open_leads,
    ( SELECT count(*) AS count
           FROM public.form_submissions fs
          WHERE ((fs.business_id = b.id) AND (fs.status = 'new'::public.form_submission_status))) AS unread_submissions,
    ( SELECT count(*) AS count
           FROM public.invoices i
          WHERE ((i.business_id = b.id) AND (i.status = 'overdue'::public.invoice_status))) AS overdue_invoices,
    ( SELECT COALESCE(sum(i.total), (0)::numeric) AS "coalesce"
           FROM public.invoices i
          WHERE ((i.business_id = b.id) AND (i.status = 'overdue'::public.invoice_status))) AS overdue_amount,
    ( SELECT COALESCE(sum(p.amount), (0)::numeric) AS "coalesce"
           FROM public.payments p
          WHERE ((p.business_id = b.id) AND (p.paid_at >= date_trunc('month'::text, now())))) AS revenue_this_month,
    ( SELECT COALESCE(sum(p.amount), (0)::numeric) AS "coalesce"
           FROM public.payments p
          WHERE ((p.business_id = b.id) AND (p.paid_at >= date_trunc('year'::text, now())))) AS revenue_this_year
   FROM public.businesses b;


--
-- Name: email_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_log (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    template_id uuid,
    contact_id uuid,
    to_email text NOT NULL,
    subject text NOT NULL,
    resend_id text,
    status public.email_status DEFAULT 'queued'::public.email_status NOT NULL,
    related_type text,
    related_id uuid,
    sent_at timestamp with time zone,
    opened_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_templates (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    subject text NOT NULL,
    body_html text DEFAULT ''::text NOT NULL,
    body_text text DEFAULT ''::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: estimate_approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estimate_approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    estimate_id uuid NOT NULL,
    estimate_version integer DEFAULT 1 NOT NULL,
    customer_name text NOT NULL,
    ip_address text,
    user_agent text,
    approved_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: estimates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estimates (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    job_id uuid,
    contact_id uuid NOT NULL,
    estimate_number text NOT NULL,
    status public.estimate_status DEFAULT 'draft'::public.estimate_status NOT NULL,
    line_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    subtotal numeric(12,2) DEFAULT 0 NOT NULL,
    tax_rate numeric(5,4) DEFAULT 0 NOT NULL,
    tax numeric(12,2) DEFAULT 0 NOT NULL,
    total numeric(12,2) DEFAULT 0 NOT NULL,
    notes text,
    valid_until date,
    sent_at timestamp with time zone,
    approved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    qbo_estimate_id text,
    approval_token text DEFAULT (gen_random_uuid())::text,
    estimate_version integer DEFAULT 1 NOT NULL
);


--
-- Name: faq_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faq_services (
    faq_id uuid NOT NULL,
    service_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: faqs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.faqs (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    question text NOT NULL,
    answer text NOT NULL,
    page_type text,
    page_id uuid,
    is_global boolean DEFAULT false NOT NULL,
    schema_markup boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: forms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    fields jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    auto_response_template_id uuid,
    thank_you_message text
);


--
-- Name: job_team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    job_id uuid NOT NULL,
    team_member_id uuid NOT NULL,
    hours_worked numeric(8,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT job_team_members_hours_nonnegative CHECK (((hours_worked IS NULL) OR (hours_worked >= (0)::numeric)))
);


--
-- Name: media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    file_name text NOT NULL,
    file_url text NOT NULL,
    file_type text NOT NULL,
    file_size integer,
    width integer,
    height integer,
    alt_text text DEFAULT ''::text,
    folder text,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    original_file_url text,
    blur_data_url text,
    storage_prefix text,
    variants jsonb,
    metadata jsonb
);


--
-- Name: COLUMN media.original_file_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media.original_file_url IS 'Original uploaded asset URL (archive/editing source).';


--
-- Name: COLUMN media.blur_data_url; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media.blur_data_url IS 'Low-quality image placeholder data URL for images.';


--
-- Name: COLUMN media.storage_prefix; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media.storage_prefix IS 'Storage prefix containing all managed files for this asset.';


--
-- Name: COLUMN media.variants; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media.variants IS 'Array of generated delivery variants (format/width/url/bytes).';


--
-- Name: COLUMN media.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.media.metadata IS 'Additional asset metadata (focal point, role, processing details, etc.).';


--
-- Name: navigation_menus; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.navigation_menus (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    location public.menu_location NOT NULL,
    items jsonb DEFAULT '[]'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pages (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    meta_title text,
    meta_description text,
    og_image_url text,
    content jsonb DEFAULT '[]'::jsonb NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    show_in_nav boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    page_kind text,
    CONSTRAINT pages_page_kind_check CHECK (((page_kind IS NULL) OR (page_kind = ANY (ARRAY['home'::text, 'services_archive'::text, 'areas_archive'::text, 'about'::text, 'blog_archive'::text, 'contact'::text]))))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    business_id uuid NOT NULL,
    role public.user_role DEFAULT 'employee'::public.user_role NOT NULL,
    first_name text,
    last_name text,
    phone text,
    avatar_url text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: project_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_services (
    project_id uuid NOT NULL,
    service_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    summary text,
    gallery_urls text[] DEFAULT '{}'::text[] NOT NULL,
    location text,
    review text,
    project_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: quickbooks_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.quickbooks_connections (
    business_id uuid NOT NULL,
    realm_id text NOT NULL,
    company_name text,
    access_token text NOT NULL,
    refresh_token text NOT NULL,
    access_token_expires_at timestamp with time zone,
    refresh_token_expires_at timestamp with time zone,
    token_type text,
    scope text,
    last_synced_at timestamp with time zone,
    last_sync_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: redirects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.redirects (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    from_path text NOT NULL,
    to_path text NOT NULL,
    type public.redirect_type DEFAULT '301'::public.redirect_type NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schedule_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone,
    location text,
    assigned_to uuid,
    related_job_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_team_member_id uuid,
    CONSTRAINT schedule_items_time_order_check CHECK (((ends_at IS NULL) OR (ends_at >= starts_at)))
);


--
-- Name: scheduled_emails; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scheduled_emails (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    automation_rule_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    related_type text,
    related_id uuid,
    scheduled_for timestamp with time zone NOT NULL,
    status public.scheduled_email_status DEFAULT 'pending'::public.scheduled_email_status NOT NULL,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: seo_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seo_settings (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    default_meta_title_suffix text DEFAULT ''::text,
    google_analytics_id text,
    google_tag_manager_id text,
    google_business_profile_url text,
    sitemap_excludes text[] DEFAULT '{}'::text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    og_image_url text
);


--
-- Name: service_areas; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.service_areas AS
 SELECT id,
    business_id,
    name,
    slug,
    content,
    meta_title,
    meta_description,
    featured_image_url,
    is_active,
    created_at,
    updated_at,
    icon
   FROM public.areas;


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    excerpt text,
    content jsonb DEFAULT '[]'::jsonb NOT NULL,
    featured_image_url text,
    icon text,
    meta_title text,
    meta_description text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    parent_service_id uuid,
    service_projects jsonb DEFAULT '[]'::jsonb NOT NULL,
    before_after_groups jsonb DEFAULT '[]'::jsonb NOT NULL,
    service_gallery_urls text[] DEFAULT '{}'::text[] NOT NULL,
    is_primary boolean DEFAULT false NOT NULL
);


--
-- Name: services_content_backup_2026_03_01; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services_content_backup_2026_03_01 (
    id uuid,
    business_id uuid,
    title text,
    slug text,
    excerpt text,
    content jsonb,
    featured_image_url text,
    icon text,
    meta_title text,
    meta_description text,
    sort_order integer,
    is_featured boolean,
    is_active boolean,
    price_range_min numeric(10,2),
    price_range_max numeric(10,2),
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent_service_id uuid,
    before_gallery_urls text[],
    service_projects jsonb,
    after_gallery_urls text[],
    before_after_groups jsonb,
    service_gallery_urls text[],
    before_after_gallery_urls text[],
    is_primary boolean
);


--
-- Name: team_member_employment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_member_employment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    team_member_id uuid NOT NULL,
    profile_id uuid,
    login_email text,
    login_status text DEFAULT 'not_created'::text NOT NULL,
    app_role public.user_role DEFAULT 'employee'::public.user_role NOT NULL,
    employment_status text DEFAULT 'full_time'::text NOT NULL,
    pay_type text DEFAULT 'hourly'::text NOT NULL,
    hourly_rate numeric(10,2),
    salary_amount numeric(12,2),
    start_date date,
    end_date date,
    internal_notes text,
    invited_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    phone text,
    CONSTRAINT team_member_employment_employment_status_check CHECK ((employment_status = ANY (ARRAY['part_time'::text, 'full_time'::text, 'contractor'::text]))),
    CONSTRAINT team_member_employment_login_status_check CHECK ((login_status = ANY (ARRAY['not_created'::text, 'invited'::text, 'active'::text, 'disabled'::text]))),
    CONSTRAINT team_member_employment_pay_type_check CHECK ((pay_type = ANY (ARRAY['hourly'::text, 'salary'::text, 'contract'::text])))
);


--
-- Name: team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    business_id uuid NOT NULL,
    title text,
    bio text,
    photo_url text,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    first_name text,
    last_name text,
    website_published boolean DEFAULT true NOT NULL
);


--
-- Name: testimonials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.testimonials (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    business_id uuid NOT NULL,
    customer_name text NOT NULL,
    rating integer,
    content text NOT NULL,
    source public.testimonial_source DEFAULT 'manual'::public.testimonial_source NOT NULL,
    source_url text,
    is_featured boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    avatar_url text,
    service_id uuid,
    review_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    area_id uuid,
    CONSTRAINT testimonials_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: upcoming_schedule; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.upcoming_schedule AS
 SELECT j.id,
    j.business_id,
    j.title,
    j.status,
    j.priority,
    j.scheduled_start,
    j.scheduled_end,
    j.address_line1,
    j.city,
    j.state,
    ((c.first_name || ' '::text) || c.last_name) AS customer_name,
    c.phone AS customer_phone,
    ((p.first_name || ' '::text) || p.last_name) AS assigned_to_name,
    s.title AS service_name
   FROM (((public.jobs j
     LEFT JOIN public.contacts c ON ((c.id = j.contact_id)))
     LEFT JOIN public.profiles p ON ((p.id = j.assigned_to)))
     LEFT JOIN public.services s ON ((s.id = j.service_id)))
  WHERE ((j.status = ANY (ARRAY['scheduled'::public.job_status, 'in_progress'::public.job_status])) AND (j.scheduled_start >= now()))
  ORDER BY j.scheduled_start;


--
-- Name: user_business_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_business_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    business_id uuid NOT NULL,
    role public.user_role DEFAULT 'admin'::public.user_role NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: zip_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zip_locations (
    zip text NOT NULL,
    city text NOT NULL,
    state_id text NOT NULL,
    state_name text NOT NULL,
    lat double precision NOT NULL,
    lng double precision NOT NULL,
    population integer,
    county_name text,
    timezone text,
    imprecise boolean DEFAULT false NOT NULL,
    military boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT zip_locations_zip_format CHECK ((zip ~ '^[0-9]{5}$'::text))
);


--
-- Name: activity_log activity_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_pkey PRIMARY KEY (id);


--
-- Name: analytics_events analytics_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_pkey PRIMARY KEY (id);


--
-- Name: areas areas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_pkey PRIMARY KEY (id);


--
-- Name: automation_rules automation_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_rules
    ADD CONSTRAINT automation_rules_pkey PRIMARY KEY (id);


--
-- Name: blog_post_services blog_post_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_post_services
    ADD CONSTRAINT blog_post_services_pkey PRIMARY KEY (blog_post_id, service_id);


--
-- Name: blog_posts blog_posts_business_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_business_id_slug_key UNIQUE (business_id, slug);


--
-- Name: blog_posts blog_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_pkey PRIMARY KEY (id);


--
-- Name: business_domains business_domains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_domains
    ADD CONSTRAINT business_domains_pkey PRIMARY KEY (id);


--
-- Name: businesses businesses_domain_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_domain_key UNIQUE (domain);


--
-- Name: businesses businesses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_pkey PRIMARY KEY (id);


--
-- Name: businesses businesses_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.businesses
    ADD CONSTRAINT businesses_slug_key UNIQUE (slug);


--
-- Name: contact_properties contact_properties_contact_id_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_properties
    ADD CONSTRAINT contact_properties_contact_id_key_key UNIQUE (contact_id, key);


--
-- Name: contact_properties contact_properties_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_properties
    ADD CONSTRAINT contact_properties_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: email_log email_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_log
    ADD CONSTRAINT email_log_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: estimate_approvals estimate_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_approvals
    ADD CONSTRAINT estimate_approvals_pkey PRIMARY KEY (id);


--
-- Name: estimates estimates_business_id_estimate_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_business_id_estimate_number_key UNIQUE (business_id, estimate_number);


--
-- Name: estimates estimates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_pkey PRIMARY KEY (id);


--
-- Name: faq_services faq_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faq_services
    ADD CONSTRAINT faq_services_pkey PRIMARY KEY (faq_id, service_id);


--
-- Name: faqs faqs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faqs
    ADD CONSTRAINT faqs_pkey PRIMARY KEY (id);


--
-- Name: form_submissions form_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_pkey PRIMARY KEY (id);


--
-- Name: forms forms_business_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forms
    ADD CONSTRAINT forms_business_id_slug_key UNIQUE (business_id, slug);


--
-- Name: forms forms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forms
    ADD CONSTRAINT forms_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_business_id_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_business_id_invoice_number_key UNIQUE (business_id, invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: job_team_members job_team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_team_members
    ADD CONSTRAINT job_team_members_pkey PRIMARY KEY (id);


--
-- Name: job_team_members job_team_members_unique_job_member; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_team_members
    ADD CONSTRAINT job_team_members_unique_job_member UNIQUE (job_id, team_member_id);


--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);


--
-- Name: media media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_pkey PRIMARY KEY (id);


--
-- Name: navigation_menus navigation_menus_business_id_location_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.navigation_menus
    ADD CONSTRAINT navigation_menus_business_id_location_key UNIQUE (business_id, location);


--
-- Name: navigation_menus navigation_menus_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.navigation_menus
    ADD CONSTRAINT navigation_menus_pkey PRIMARY KEY (id);


--
-- Name: pages pages_business_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_business_id_slug_key UNIQUE (business_id, slug);


--
-- Name: pages pages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: project_services project_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_services
    ADD CONSTRAINT project_services_pkey PRIMARY KEY (project_id, service_id);


--
-- Name: projects projects_business_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_business_slug_key UNIQUE (business_id, slug);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: quickbooks_connections quickbooks_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quickbooks_connections
    ADD CONSTRAINT quickbooks_connections_pkey PRIMARY KEY (business_id);


--
-- Name: quickbooks_connections quickbooks_connections_realm_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quickbooks_connections
    ADD CONSTRAINT quickbooks_connections_realm_id_key UNIQUE (realm_id);


--
-- Name: redirects redirects_business_id_from_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redirects
    ADD CONSTRAINT redirects_business_id_from_path_key UNIQUE (business_id, from_path);


--
-- Name: redirects redirects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redirects
    ADD CONSTRAINT redirects_pkey PRIMARY KEY (id);


--
-- Name: schedule_items schedule_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_items
    ADD CONSTRAINT schedule_items_pkey PRIMARY KEY (id);


--
-- Name: scheduled_emails scheduled_emails_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_emails
    ADD CONSTRAINT scheduled_emails_pkey PRIMARY KEY (id);


--
-- Name: seo_settings seo_settings_business_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seo_settings
    ADD CONSTRAINT seo_settings_business_id_key UNIQUE (business_id);


--
-- Name: seo_settings seo_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seo_settings
    ADD CONSTRAINT seo_settings_pkey PRIMARY KEY (id);


--
-- Name: areas service_areas_business_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT service_areas_business_id_slug_key UNIQUE (business_id, slug);


--
-- Name: services services_business_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_business_id_slug_key UNIQUE (business_id, slug);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: team_member_employment team_member_employment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_member_employment
    ADD CONSTRAINT team_member_employment_pkey PRIMARY KEY (id);


--
-- Name: team_member_employment team_member_employment_profile_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_member_employment
    ADD CONSTRAINT team_member_employment_profile_id_key UNIQUE (profile_id);


--
-- Name: team_member_employment team_member_employment_team_member_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_member_employment
    ADD CONSTRAINT team_member_employment_team_member_id_key UNIQUE (team_member_id);


--
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);


--
-- Name: testimonials testimonials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.testimonials
    ADD CONSTRAINT testimonials_pkey PRIMARY KEY (id);


--
-- Name: user_business_access user_business_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_business_access
    ADD CONSTRAINT user_business_access_pkey PRIMARY KEY (id);


--
-- Name: user_business_access user_business_access_user_id_business_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_business_access
    ADD CONSTRAINT user_business_access_user_id_business_id_key UNIQUE (user_id, business_id);


--
-- Name: zip_locations zip_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zip_locations
    ADD CONSTRAINT zip_locations_pkey PRIMARY KEY (zip);


--
-- Name: blog_post_services_service_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX blog_post_services_service_id_idx ON public.blog_post_services USING btree (service_id);


--
-- Name: business_domains_business_domain_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX business_domains_business_domain_unique_idx ON public.business_domains USING btree (business_id, lower(TRIM(BOTH FROM domain)));


--
-- Name: business_domains_business_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX business_domains_business_id_idx ON public.business_domains USING btree (business_id);


--
-- Name: business_domains_domain_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX business_domains_domain_unique_idx ON public.business_domains USING btree (lower(TRIM(BOTH FROM domain))) WHERE (is_active = true);


--
-- Name: business_domains_primary_per_business_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX business_domains_primary_per_business_idx ON public.business_domains USING btree (business_id) WHERE ((is_primary = true) AND (is_active = true));


--
-- Name: businesses_domain_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX businesses_domain_unique_idx ON public.businesses USING btree (domain) WHERE (domain IS NOT NULL);


--
-- Name: businesses_slug_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX businesses_slug_unique_idx ON public.businesses USING btree (slug);


--
-- Name: businesses_theme_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX businesses_theme_key_key ON public.businesses USING btree (theme_key);


--
-- Name: contacts_business_lower_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contacts_business_lower_email_idx ON public.contacts USING btree (business_id, lower(email)) WHERE ((email IS NOT NULL) AND (btrim(email) <> ''::text));


--
-- Name: contacts_business_name_address_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contacts_business_name_address_idx ON public.contacts USING btree (business_id, lower(first_name), lower(last_name), lower(address_line1)) WHERE ((first_name IS NOT NULL) AND (btrim(first_name) <> ''::text) AND (last_name IS NOT NULL) AND (btrim(last_name) <> ''::text) AND (address_line1 IS NOT NULL) AND (btrim(address_line1) <> ''::text));


--
-- Name: contacts_business_name_city_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contacts_business_name_city_idx ON public.contacts USING btree (business_id, lower(first_name), lower(last_name), lower(city)) WHERE ((first_name IS NOT NULL) AND (btrim(first_name) <> ''::text) AND (last_name IS NOT NULL) AND (btrim(last_name) <> ''::text) AND (city IS NOT NULL) AND (btrim(city) <> ''::text));


--
-- Name: contacts_business_normalized_phone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contacts_business_normalized_phone_idx ON public.contacts USING btree (business_id, regexp_replace(phone, '\D'::text, ''::text, 'g'::text)) WHERE ((phone IS NOT NULL) AND (btrim(phone) <> ''::text));


--
-- Name: contacts_qbo_customer_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contacts_qbo_customer_id_idx ON public.contacts USING btree (qbo_customer_id);


--
-- Name: contacts_source_submission_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contacts_source_submission_id_idx ON public.contacts USING btree (source_submission_id) WHERE (source_submission_id IS NOT NULL);


--
-- Name: email_templates_business_name_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX email_templates_business_name_unique_idx ON public.email_templates USING btree (business_id, lower(TRIM(BOTH FROM name)));


--
-- Name: estimate_approvals_business_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX estimate_approvals_business_id_idx ON public.estimate_approvals USING btree (business_id, approved_at DESC);


--
-- Name: estimate_approvals_estimate_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX estimate_approvals_estimate_id_idx ON public.estimate_approvals USING btree (estimate_id, approved_at DESC);


--
-- Name: estimates_approval_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX estimates_approval_token_idx ON public.estimates USING btree (approval_token);


--
-- Name: estimates_qbo_estimate_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX estimates_qbo_estimate_id_idx ON public.estimates USING btree (qbo_estimate_id);


--
-- Name: faq_services_service_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX faq_services_service_id_idx ON public.faq_services USING btree (service_id);


--
-- Name: form_submissions_business_contact_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX form_submissions_business_contact_created_idx ON public.form_submissions USING btree (business_id, contact_id, created_at DESC);


--
-- Name: forms_auto_response_template_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX forms_auto_response_template_id_idx ON public.forms USING btree (auto_response_template_id);


--
-- Name: forms_business_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX forms_business_id_idx ON public.forms USING btree (business_id);


--
-- Name: forms_business_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX forms_business_slug_idx ON public.forms USING btree (business_id, slug);


--
-- Name: idx_activity_log_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_log_business ON public.activity_log USING btree (business_id, created_at DESC);


--
-- Name: idx_activity_log_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_log_entity ON public.activity_log USING btree (entity_type, entity_id);


--
-- Name: idx_analytics_events_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_business ON public.analytics_events USING btree (business_id, created_at DESC);


--
-- Name: idx_analytics_events_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_analytics_events_session ON public.analytics_events USING btree (session_id);


--
-- Name: idx_automation_rules_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_automation_rules_business ON public.automation_rules USING btree (business_id, is_active);


--
-- Name: idx_contacts_business_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_business_status ON public.contacts USING btree (business_id, status);


--
-- Name: idx_contacts_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_email ON public.contacts USING btree (business_id, email);


--
-- Name: idx_contacts_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_name ON public.contacts USING btree (business_id, last_name, first_name);


--
-- Name: idx_contacts_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_phone ON public.contacts USING btree (business_id, phone);


--
-- Name: idx_contacts_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_tags ON public.contacts USING gin (tags);


--
-- Name: idx_email_log_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_log_business ON public.email_log USING btree (business_id, created_at DESC);


--
-- Name: idx_email_log_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_log_contact ON public.email_log USING btree (contact_id, created_at DESC);


--
-- Name: idx_email_log_resend; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_log_resend ON public.email_log USING btree (resend_id);


--
-- Name: idx_estimates_business_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_estimates_business_status ON public.estimates USING btree (business_id, status);


--
-- Name: idx_estimates_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_estimates_contact ON public.estimates USING btree (contact_id);


--
-- Name: idx_faqs_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_faqs_business ON public.faqs USING btree (business_id);


--
-- Name: idx_faqs_page; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_faqs_page ON public.faqs USING btree (page_type, page_id);


--
-- Name: idx_form_submissions_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_form_submissions_business ON public.form_submissions USING btree (business_id, status, created_at DESC);


--
-- Name: idx_invoices_business_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_business_status ON public.invoices USING btree (business_id, status);


--
-- Name: idx_invoices_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_contact ON public.invoices USING btree (contact_id);


--
-- Name: idx_invoices_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_due ON public.invoices USING btree (business_id, due_date) WHERE (status = ANY (ARRAY['sent'::public.invoice_status, 'viewed'::public.invoice_status, 'overdue'::public.invoice_status]));


--
-- Name: idx_jobs_assigned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jobs_assigned ON public.jobs USING btree (assigned_to, status);


--
-- Name: idx_jobs_business_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jobs_business_status ON public.jobs USING btree (business_id, status);


--
-- Name: idx_jobs_contact; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jobs_contact ON public.jobs USING btree (contact_id);


--
-- Name: idx_jobs_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_jobs_scheduled ON public.jobs USING btree (business_id, scheduled_start);


--
-- Name: idx_media_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_business ON public.media USING btree (business_id);


--
-- Name: idx_media_folder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_media_folder ON public.media USING btree (business_id, folder);


--
-- Name: idx_payments_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_business ON public.payments USING btree (business_id, paid_at DESC);


--
-- Name: idx_payments_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_invoice ON public.payments USING btree (invoice_id);


--
-- Name: idx_profiles_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_business ON public.profiles USING btree (business_id);


--
-- Name: idx_redirects_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_redirects_lookup ON public.redirects USING btree (business_id, from_path) WHERE (is_active = true);


--
-- Name: idx_scheduled_emails_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scheduled_emails_pending ON public.scheduled_emails USING btree (scheduled_for) WHERE (status = 'pending'::public.scheduled_email_status);


--
-- Name: idx_testimonials_business; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_testimonials_business ON public.testimonials USING btree (business_id);


--
-- Name: invoices_qbo_invoice_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoices_qbo_invoice_id_idx ON public.invoices USING btree (qbo_invoice_id);


--
-- Name: job_team_members_business_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX job_team_members_business_id_idx ON public.job_team_members USING btree (business_id);


--
-- Name: job_team_members_job_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX job_team_members_job_id_idx ON public.job_team_members USING btree (job_id);


--
-- Name: job_team_members_team_member_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX job_team_members_team_member_id_idx ON public.job_team_members USING btree (team_member_id);


--
-- Name: jobs_assigned_team_member_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX jobs_assigned_team_member_id_idx ON public.jobs USING btree (assigned_team_member_id);


--
-- Name: pages_business_id_page_kind_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX pages_business_id_page_kind_idx ON public.pages USING btree (business_id, page_kind) WHERE (page_kind IS NOT NULL);


--
-- Name: payments_qbo_payment_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_qbo_payment_id_idx ON public.payments USING btree (qbo_payment_id);


--
-- Name: project_services_service_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX project_services_service_id_idx ON public.project_services USING btree (service_id);


--
-- Name: projects_active_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX projects_active_date_idx ON public.projects USING btree (business_id, project_date DESC, created_at DESC);


--
-- Name: projects_business_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX projects_business_id_idx ON public.projects USING btree (business_id);


--
-- Name: schedule_items_assigned_team_member_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedule_items_assigned_team_member_id_idx ON public.schedule_items USING btree (assigned_team_member_id, starts_at);


--
-- Name: schedule_items_assigned_to_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedule_items_assigned_to_idx ON public.schedule_items USING btree (assigned_to, starts_at);


--
-- Name: schedule_items_business_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedule_items_business_id_idx ON public.schedule_items USING btree (business_id);


--
-- Name: schedule_items_starts_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX schedule_items_starts_at_idx ON public.schedule_items USING btree (business_id, starts_at);


--
-- Name: services_business_slug_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX services_business_slug_unique_idx ON public.services USING btree (business_id, slug);


--
-- Name: services_one_primary_per_business_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX services_one_primary_per_business_idx ON public.services USING btree (business_id) WHERE (is_primary = true);


--
-- Name: services_parent_service_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX services_parent_service_id_idx ON public.services USING btree (parent_service_id);


--
-- Name: team_member_employment_business_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX team_member_employment_business_id_idx ON public.team_member_employment USING btree (business_id);


--
-- Name: team_member_employment_profile_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX team_member_employment_profile_id_idx ON public.team_member_employment USING btree (profile_id);


--
-- Name: team_member_employment_team_member_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX team_member_employment_team_member_id_idx ON public.team_member_employment USING btree (team_member_id);


--
-- Name: team_members_business_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX team_members_business_id_idx ON public.team_members USING btree (business_id);


--
-- Name: user_business_access_business_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_business_access_business_id_idx ON public.user_business_access USING btree (business_id);


--
-- Name: user_business_access_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_business_access_user_id_idx ON public.user_business_access USING btree (user_id);


--
-- Name: zip_locations_lat_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX zip_locations_lat_idx ON public.zip_locations USING btree (lat);


--
-- Name: zip_locations_lng_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX zip_locations_lng_idx ON public.zip_locations USING btree (lng);


--
-- Name: zip_locations_state_city_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX zip_locations_state_city_idx ON public.zip_locations USING btree (state_id, city);


--
-- Name: estimates auto_estimate_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER auto_estimate_number BEFORE INSERT ON public.estimates FOR EACH ROW EXECUTE FUNCTION public.generate_estimate_number();


--
-- Name: invoices auto_invoice_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER auto_invoice_number BEFORE INSERT ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.generate_invoice_number();


--
-- Name: blog_posts auto_published_at_blog; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER auto_published_at_blog BEFORE UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION public.set_published_at();


--
-- Name: business_domains business_domains_normalize_fields_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER business_domains_normalize_fields_trigger BEFORE INSERT OR UPDATE ON public.business_domains FOR EACH ROW EXECUTE FUNCTION public.normalize_business_domains_fields();


--
-- Name: businesses grant_platform_admin_access_for_new_business; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER grant_platform_admin_access_for_new_business AFTER INSERT ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.grant_platform_admin_access_for_new_business();


--
-- Name: forms set_forms_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_forms_updated_at BEFORE UPDATE ON public.forms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: quickbooks_connections set_quickbooks_connections_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_quickbooks_connections_updated_at BEFORE UPDATE ON public.quickbooks_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: areas set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.areas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: automation_rules set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.automation_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: blog_posts set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: businesses set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.businesses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: contacts set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: email_templates set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: estimates set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.estimates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: faqs set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.faqs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: invoices set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: jobs set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: pages set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: profiles set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: seo_settings set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.seo_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: services set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: user_business_access set_user_business_access_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_user_business_access_updated_at BEFORE UPDATE ON public.user_business_access FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


--
-- Name: payments update_ltv_on_payment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ltv_on_payment AFTER INSERT OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_contact_lifetime_value();


--
-- Name: activity_log activity_log_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: activity_log activity_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_log
    ADD CONSTRAINT activity_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: analytics_events analytics_events_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: areas areas_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: automation_rules automation_rules_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_rules
    ADD CONSTRAINT automation_rules_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: automation_rules automation_rules_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_rules
    ADD CONSTRAINT automation_rules_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.email_templates(id) ON DELETE CASCADE;


--
-- Name: blog_post_services blog_post_services_blog_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_post_services
    ADD CONSTRAINT blog_post_services_blog_post_id_fkey FOREIGN KEY (blog_post_id) REFERENCES public.blog_posts(id) ON DELETE CASCADE;


--
-- Name: blog_post_services blog_post_services_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_post_services
    ADD CONSTRAINT blog_post_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: blog_posts blog_posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: blog_posts blog_posts_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: business_domains business_domains_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.business_domains
    ADD CONSTRAINT business_domains_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: contact_properties contact_properties_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_properties
    ADD CONSTRAINT contact_properties_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_source_submission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_source_submission_id_fkey FOREIGN KEY (source_submission_id) REFERENCES public.form_submissions(id) ON DELETE SET NULL;


--
-- Name: email_log email_log_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_log
    ADD CONSTRAINT email_log_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: email_log email_log_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_log
    ADD CONSTRAINT email_log_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: email_log email_log_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_log
    ADD CONSTRAINT email_log_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.email_templates(id) ON DELETE SET NULL;


--
-- Name: email_templates email_templates_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: estimate_approvals estimate_approvals_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_approvals
    ADD CONSTRAINT estimate_approvals_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: estimate_approvals estimate_approvals_estimate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimate_approvals
    ADD CONSTRAINT estimate_approvals_estimate_id_fkey FOREIGN KEY (estimate_id) REFERENCES public.estimates(id) ON DELETE CASCADE;


--
-- Name: estimates estimates_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: estimates estimates_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE RESTRICT;


--
-- Name: estimates estimates_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estimates
    ADD CONSTRAINT estimates_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE SET NULL;


--
-- Name: faq_services faq_services_faq_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faq_services
    ADD CONSTRAINT faq_services_faq_id_fkey FOREIGN KEY (faq_id) REFERENCES public.faqs(id) ON DELETE CASCADE;


--
-- Name: faq_services faq_services_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faq_services
    ADD CONSTRAINT faq_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: faqs faqs_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.faqs
    ADD CONSTRAINT faqs_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: form_submissions form_submissions_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: form_submissions form_submissions_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.form_submissions
    ADD CONSTRAINT form_submissions_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE SET NULL;


--
-- Name: forms forms_auto_response_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forms
    ADD CONSTRAINT forms_auto_response_template_id_fkey FOREIGN KEY (auto_response_template_id) REFERENCES public.email_templates(id) ON DELETE SET NULL;


--
-- Name: forms forms_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forms
    ADD CONSTRAINT forms_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE RESTRICT;


--
-- Name: invoices invoices_estimate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_estimate_id_fkey FOREIGN KEY (estimate_id) REFERENCES public.estimates(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE SET NULL;


--
-- Name: job_team_members job_team_members_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_team_members
    ADD CONSTRAINT job_team_members_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: job_team_members job_team_members_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_team_members
    ADD CONSTRAINT job_team_members_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;


--
-- Name: job_team_members job_team_members_team_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_team_members
    ADD CONSTRAINT job_team_members_team_member_id_fkey FOREIGN KEY (team_member_id) REFERENCES public.team_members(id) ON DELETE CASCADE;


--
-- Name: jobs jobs_assigned_team_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_assigned_team_member_id_fkey FOREIGN KEY (assigned_team_member_id) REFERENCES public.team_members(id) ON DELETE SET NULL;


--
-- Name: jobs jobs_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: jobs jobs_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: jobs jobs_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE RESTRICT;


--
-- Name: jobs jobs_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: media media_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: media media_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: navigation_menus navigation_menus_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.navigation_menus
    ADD CONSTRAINT navigation_menus_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: pages pages_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pages
    ADD CONSTRAINT pages_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: payments payments_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: payments payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE RESTRICT;


--
-- Name: profiles profiles_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: project_services project_services_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_services
    ADD CONSTRAINT project_services_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_services project_services_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_services
    ADD CONSTRAINT project_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;


--
-- Name: projects projects_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: quickbooks_connections quickbooks_connections_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.quickbooks_connections
    ADD CONSTRAINT quickbooks_connections_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: redirects redirects_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.redirects
    ADD CONSTRAINT redirects_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: schedule_items schedule_items_assigned_team_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_items
    ADD CONSTRAINT schedule_items_assigned_team_member_id_fkey FOREIGN KEY (assigned_team_member_id) REFERENCES public.team_members(id) ON DELETE SET NULL;


--
-- Name: schedule_items schedule_items_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_items
    ADD CONSTRAINT schedule_items_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: schedule_items schedule_items_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_items
    ADD CONSTRAINT schedule_items_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: schedule_items schedule_items_related_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_items
    ADD CONSTRAINT schedule_items_related_job_id_fkey FOREIGN KEY (related_job_id) REFERENCES public.jobs(id) ON DELETE SET NULL;


--
-- Name: scheduled_emails scheduled_emails_automation_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_emails
    ADD CONSTRAINT scheduled_emails_automation_rule_id_fkey FOREIGN KEY (automation_rule_id) REFERENCES public.automation_rules(id) ON DELETE CASCADE;


--
-- Name: scheduled_emails scheduled_emails_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scheduled_emails
    ADD CONSTRAINT scheduled_emails_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id) ON DELETE CASCADE;


--
-- Name: seo_settings seo_settings_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seo_settings
    ADD CONSTRAINT seo_settings_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: services services_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: services services_parent_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_parent_service_id_fkey FOREIGN KEY (parent_service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: team_member_employment team_member_employment_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_member_employment
    ADD CONSTRAINT team_member_employment_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: team_member_employment team_member_employment_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_member_employment
    ADD CONSTRAINT team_member_employment_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: team_member_employment team_member_employment_team_member_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_member_employment
    ADD CONSTRAINT team_member_employment_team_member_id_fkey FOREIGN KEY (team_member_id) REFERENCES public.team_members(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: testimonials testimonials_area_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.testimonials
    ADD CONSTRAINT testimonials_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.areas(id) ON DELETE SET NULL;


--
-- Name: testimonials testimonials_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.testimonials
    ADD CONSTRAINT testimonials_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: testimonials testimonials_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.testimonials
    ADD CONSTRAINT testimonials_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;


--
-- Name: user_business_access user_business_access_business_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_business_access
    ADD CONSTRAINT user_business_access_business_id_fkey FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;


--
-- Name: user_business_access user_business_access_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_business_access
    ADD CONSTRAINT user_business_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: analytics_events Anyone can insert analytics to valid businesses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can insert analytics to valid businesses" ON public.analytics_events FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE (b.id = analytics_events.business_id))));


--
-- Name: form_submissions Anyone can submit forms to valid businesses; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can submit forms to valid businesses" ON public.form_submissions FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.businesses b
  WHERE (b.id = form_submissions.business_id))));


--
-- Name: activity_log Auth users manage activity_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth users manage activity_log" ON public.activity_log USING ((business_id = public.get_my_business_id())) WITH CHECK ((business_id = public.get_my_business_id()));


--
-- Name: analytics_events Auth users manage analytics_events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth users manage analytics_events" ON public.analytics_events USING ((business_id = public.get_my_business_id())) WITH CHECK ((business_id = public.get_my_business_id()));


--
-- Name: blog_posts Auth users manage blog_posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth users manage blog_posts" ON public.blog_posts USING ((business_id = public.get_my_business_id())) WITH CHECK ((business_id = public.get_my_business_id()));


--
-- Name: contact_properties Auth users manage contact_properties; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth users manage contact_properties" ON public.contact_properties USING ((EXISTS ( SELECT 1
   FROM public.contacts c
  WHERE ((c.id = contact_properties.contact_id) AND (c.business_id = public.get_my_business_id()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.contacts c
  WHERE ((c.id = contact_properties.contact_id) AND (c.business_id = public.get_my_business_id())))));


--
-- Name: email_log Auth users manage email_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth users manage email_log" ON public.email_log USING ((business_id = public.get_my_business_id())) WITH CHECK ((business_id = public.get_my_business_id()));


--
-- Name: estimates Auth users manage estimates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth users manage estimates" ON public.estimates USING ((business_id = public.get_my_business_id())) WITH CHECK ((business_id = public.get_my_business_id()));


--
-- Name: faqs Auth users manage faqs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth users manage faqs" ON public.faqs USING ((business_id = public.get_my_business_id())) WITH CHECK ((business_id = public.get_my_business_id()));


--
-- Name: invoices Auth users manage invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth users manage invoices" ON public.invoices USING ((business_id = public.get_my_business_id())) WITH CHECK ((business_id = public.get_my_business_id()));


--
-- Name: jobs Auth users manage jobs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth users manage jobs" ON public.jobs USING ((business_id = public.get_my_business_id())) WITH CHECK ((business_id = public.get_my_business_id()));


--
-- Name: media Auth users manage media; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth users manage media" ON public.media USING ((business_id = public.get_my_business_id())) WITH CHECK ((business_id = public.get_my_business_id()));


--
-- Name: navigation_menus Auth users manage navigation_menus; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth users manage navigation_menus" ON public.navigation_menus USING ((business_id = public.get_my_business_id())) WITH CHECK ((business_id = public.get_my_business_id()));


--
-- Name: pages Auth users manage pages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth users manage pages" ON public.pages USING ((business_id = public.get_my_business_id())) WITH CHECK ((business_id = public.get_my_business_id()));


--
-- Name: payments Auth users manage payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth users manage payments" ON public.payments USING ((business_id = public.get_my_business_id())) WITH CHECK ((business_id = public.get_my_business_id()));


--
-- Name: redirects Auth users manage redirects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth users manage redirects" ON public.redirects USING ((business_id = public.get_my_business_id())) WITH CHECK ((business_id = public.get_my_business_id()));


--
-- Name: scheduled_emails Auth users manage scheduled_emails; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth users manage scheduled_emails" ON public.scheduled_emails USING ((EXISTS ( SELECT 1
   FROM public.automation_rules ar
  WHERE ((ar.id = scheduled_emails.automation_rule_id) AND (ar.business_id = public.get_my_business_id()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.automation_rules ar
  WHERE ((ar.id = scheduled_emails.automation_rule_id) AND (ar.business_id = public.get_my_business_id())))));


--
-- Name: seo_settings Auth users manage seo_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth users manage seo_settings" ON public.seo_settings USING ((business_id = public.get_my_business_id())) WITH CHECK ((business_id = public.get_my_business_id()));


--
-- Name: areas Auth users manage service_areas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth users manage service_areas" ON public.areas USING ((business_id = public.get_my_business_id())) WITH CHECK ((business_id = public.get_my_business_id()));


--
-- Name: services Auth users manage services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth users manage services" ON public.services USING ((business_id = public.get_my_business_id())) WITH CHECK ((business_id = public.get_my_business_id()));


--
-- Name: testimonials Auth users manage testimonials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Auth users manage testimonials" ON public.testimonials USING ((business_id = public.get_my_business_id())) WITH CHECK ((business_id = public.get_my_business_id()));


--
-- Name: businesses Authenticated users can create a business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create a business" ON public.businesses FOR INSERT WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: businesses Owners can update their business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can update their business" ON public.businesses FOR UPDATE USING ((id = public.get_my_business_id())) WITH CHECK ((id = public.get_my_business_id()));


--
-- Name: pages Public reads active pages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public reads active pages" ON public.pages FOR SELECT USING ((is_active = true));


--
-- Name: redirects Public reads active redirects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public reads active redirects" ON public.redirects FOR SELECT USING ((is_active = true));


--
-- Name: areas Public reads active service_areas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public reads active service_areas" ON public.areas FOR SELECT USING ((is_active = true));


--
-- Name: services Public reads active services; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public reads active services" ON public.services FOR SELECT USING ((is_active = true));


--
-- Name: testimonials Public reads active testimonials; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public reads active testimonials" ON public.testimonials FOR SELECT USING ((is_active = true));


--
-- Name: faqs Public reads faqs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public reads faqs" ON public.faqs FOR SELECT USING (true);


--
-- Name: media Public reads media; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public reads media" ON public.media FOR SELECT USING (true);


--
-- Name: navigation_menus Public reads navigation_menus; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public reads navigation_menus" ON public.navigation_menus FOR SELECT USING (true);


--
-- Name: blog_posts Public reads published blog_posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public reads published blog_posts" ON public.blog_posts FOR SELECT USING ((status = 'published'::public.post_status));


--
-- Name: seo_settings Public reads seo_settings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public reads seo_settings" ON public.seo_settings FOR SELECT USING (true);


--
-- Name: profiles Users can create their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((id = auth.uid()));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING ((id = auth.uid())) WITH CHECK ((id = auth.uid()));


--
-- Name: businesses Users can view their own business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own business" ON public.businesses FOR SELECT USING ((id = public.get_my_business_id()));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT TO authenticated USING ((id = auth.uid()));


--
-- Name: activity_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

--
-- Name: analytics_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

--
-- Name: areas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_rules automation_rules_authenticated_delete_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_rules_authenticated_delete_own_business ON public.automation_rules FOR DELETE TO authenticated USING (public.current_user_has_business_access(business_id));


--
-- Name: automation_rules automation_rules_authenticated_insert_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_rules_authenticated_insert_own_business ON public.automation_rules FOR INSERT TO authenticated WITH CHECK (public.current_user_has_business_access(business_id));


--
-- Name: automation_rules automation_rules_authenticated_read_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_rules_authenticated_read_own_business ON public.automation_rules FOR SELECT TO authenticated USING (public.current_user_has_business_access(business_id));


--
-- Name: automation_rules automation_rules_authenticated_update_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_rules_authenticated_update_own_business ON public.automation_rules FOR UPDATE TO authenticated USING (public.current_user_has_business_access(business_id)) WITH CHECK (public.current_user_has_business_access(business_id));


--
-- Name: blog_post_services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blog_post_services ENABLE ROW LEVEL SECURITY;

--
-- Name: blog_post_services blog_post_services_authenticated_write_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY blog_post_services_authenticated_write_own_business ON public.blog_post_services TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.blog_posts bp
     JOIN public.services s ON (((s.id = blog_post_services.service_id) AND (s.business_id = bp.business_id))))
  WHERE ((bp.id = blog_post_services.blog_post_id) AND public.current_user_has_business_access(bp.business_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.blog_posts bp
     JOIN public.services s ON (((s.id = blog_post_services.service_id) AND (s.business_id = bp.business_id))))
  WHERE ((bp.id = blog_post_services.blog_post_id) AND public.current_user_has_business_access(bp.business_id)))));


--
-- Name: blog_post_services blog_post_services_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY blog_post_services_public_read ON public.blog_post_services FOR SELECT TO authenticated, anon USING (true);


--
-- Name: blog_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: business_domains; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.business_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: business_domains business_domains_public_select_active; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY business_domains_public_select_active ON public.business_domains FOR SELECT USING ((is_active = true));


--
-- Name: businesses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

--
-- Name: businesses businesses_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY businesses_public_read ON public.businesses FOR SELECT TO authenticated, anon USING (true);


--
-- Name: contact_properties; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contact_properties ENABLE ROW LEVEL SECURITY;

--
-- Name: contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: contacts contacts_authenticated_delete_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contacts_authenticated_delete_own_business ON public.contacts FOR DELETE TO authenticated USING (public.current_user_has_business_access(business_id));


--
-- Name: contacts contacts_authenticated_insert_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contacts_authenticated_insert_own_business ON public.contacts FOR INSERT TO authenticated WITH CHECK (public.current_user_has_business_access(business_id));


--
-- Name: contacts contacts_authenticated_read_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contacts_authenticated_read_own_business ON public.contacts FOR SELECT TO authenticated USING (public.current_user_has_business_access(business_id));


--
-- Name: contacts contacts_authenticated_update_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contacts_authenticated_update_own_business ON public.contacts FOR UPDATE TO authenticated USING (public.current_user_has_business_access(business_id)) WITH CHECK (public.current_user_has_business_access(business_id));


--
-- Name: email_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

--
-- Name: email_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: email_templates email_templates_authenticated_delete_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_templates_authenticated_delete_own_business ON public.email_templates FOR DELETE TO authenticated USING (public.current_user_has_business_access(business_id));


--
-- Name: email_templates email_templates_authenticated_insert_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_templates_authenticated_insert_own_business ON public.email_templates FOR INSERT TO authenticated WITH CHECK (public.current_user_has_business_access(business_id));


--
-- Name: email_templates email_templates_authenticated_read_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_templates_authenticated_read_own_business ON public.email_templates FOR SELECT TO authenticated USING (public.current_user_has_business_access(business_id));


--
-- Name: email_templates email_templates_authenticated_update_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_templates_authenticated_update_own_business ON public.email_templates FOR UPDATE TO authenticated USING (public.current_user_has_business_access(business_id)) WITH CHECK (public.current_user_has_business_access(business_id));


--
-- Name: estimate_approvals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.estimate_approvals ENABLE ROW LEVEL SECURITY;

--
-- Name: estimate_approvals estimate_approvals_authenticated_read_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY estimate_approvals_authenticated_read_own_business ON public.estimate_approvals FOR SELECT TO authenticated USING (public.current_user_has_business_access(business_id));


--
-- Name: estimates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

--
-- Name: faq_services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.faq_services ENABLE ROW LEVEL SECURITY;

--
-- Name: faq_services faq_services_authenticated_write_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY faq_services_authenticated_write_own_business ON public.faq_services TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.faqs f
     JOIN public.services s ON (((s.id = faq_services.service_id) AND (s.business_id = f.business_id))))
  WHERE ((f.id = faq_services.faq_id) AND public.current_user_has_business_access(f.business_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.faqs f
     JOIN public.services s ON (((s.id = faq_services.service_id) AND (s.business_id = f.business_id))))
  WHERE ((f.id = faq_services.faq_id) AND public.current_user_has_business_access(f.business_id)))));


--
-- Name: faq_services faq_services_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY faq_services_public_read ON public.faq_services FOR SELECT TO authenticated, anon USING (true);


--
-- Name: faqs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;

--
-- Name: form_submissions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

--
-- Name: form_submissions form_submissions_authenticated_delete_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_submissions_authenticated_delete_own_business ON public.form_submissions FOR DELETE TO authenticated USING (public.current_user_has_business_access(business_id));


--
-- Name: form_submissions form_submissions_authenticated_insert_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_submissions_authenticated_insert_own_business ON public.form_submissions FOR INSERT TO authenticated WITH CHECK (public.current_user_has_business_access(business_id));


--
-- Name: form_submissions form_submissions_authenticated_read_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_submissions_authenticated_read_own_business ON public.form_submissions FOR SELECT TO authenticated USING (public.current_user_has_business_access(business_id));


--
-- Name: form_submissions form_submissions_authenticated_update_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY form_submissions_authenticated_update_own_business ON public.form_submissions FOR UPDATE TO authenticated USING (public.current_user_has_business_access(business_id)) WITH CHECK (public.current_user_has_business_access(business_id));


--
-- Name: forms; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;

--
-- Name: forms forms_authenticated_delete_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forms_authenticated_delete_own_business ON public.forms FOR DELETE TO authenticated USING (public.current_user_has_business_access(business_id));


--
-- Name: forms forms_authenticated_insert_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forms_authenticated_insert_own_business ON public.forms FOR INSERT TO authenticated WITH CHECK (public.current_user_has_business_access(business_id));


--
-- Name: forms forms_authenticated_read_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forms_authenticated_read_own_business ON public.forms FOR SELECT TO authenticated USING (public.current_user_has_business_access(business_id));


--
-- Name: forms forms_authenticated_update_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forms_authenticated_update_own_business ON public.forms FOR UPDATE TO authenticated USING (public.current_user_has_business_access(business_id)) WITH CHECK (public.current_user_has_business_access(business_id));


--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: job_team_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_team_members ENABLE ROW LEVEL SECURITY;

--
-- Name: job_team_members job_team_members_authenticated_read_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY job_team_members_authenticated_read_own_business ON public.job_team_members FOR SELECT TO authenticated USING (public.current_user_has_business_access(business_id));


--
-- Name: job_team_members job_team_members_authenticated_write_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY job_team_members_authenticated_write_own_business ON public.job_team_members TO authenticated USING (public.current_user_has_business_access(business_id)) WITH CHECK (public.current_user_has_business_access(business_id));


--
-- Name: jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: media; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

--
-- Name: navigation_menus; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.navigation_menus ENABLE ROW LEVEL SECURITY;

--
-- Name: pages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: project_services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_services ENABLE ROW LEVEL SECURITY;

--
-- Name: project_services project_services_authenticated_write_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY project_services_authenticated_write_own_business ON public.project_services TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.projects pr
     JOIN public.services s ON (((s.id = project_services.service_id) AND (s.business_id = pr.business_id))))
  WHERE ((pr.id = project_services.project_id) AND public.current_user_has_business_access(pr.business_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.projects pr
     JOIN public.services s ON (((s.id = project_services.service_id) AND (s.business_id = pr.business_id))))
  WHERE ((pr.id = project_services.project_id) AND public.current_user_has_business_access(pr.business_id)))));


--
-- Name: project_services project_services_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY project_services_public_read ON public.project_services FOR SELECT TO authenticated, anon USING (true);


--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: projects projects_authenticated_delete_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY projects_authenticated_delete_own_business ON public.projects FOR DELETE TO authenticated USING (public.current_user_has_business_access(business_id));


--
-- Name: projects projects_authenticated_insert_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY projects_authenticated_insert_own_business ON public.projects FOR INSERT TO authenticated WITH CHECK (public.current_user_has_business_access(business_id));


--
-- Name: projects projects_authenticated_update_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY projects_authenticated_update_own_business ON public.projects FOR UPDATE TO authenticated USING (public.current_user_has_business_access(business_id)) WITH CHECK (public.current_user_has_business_access(business_id));


--
-- Name: projects projects_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY projects_public_read ON public.projects FOR SELECT TO authenticated, anon USING (true);


--
-- Name: quickbooks_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.quickbooks_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: quickbooks_connections quickbooks_connections_authenticated_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY quickbooks_connections_authenticated_own_business ON public.quickbooks_connections TO authenticated USING (public.current_user_has_business_access(business_id)) WITH CHECK (public.current_user_has_business_access(business_id));


--
-- Name: redirects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.redirects ENABLE ROW LEVEL SECURITY;

--
-- Name: schedule_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.schedule_items ENABLE ROW LEVEL SECURITY;

--
-- Name: schedule_items schedule_items_authenticated_read_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY schedule_items_authenticated_read_own_business ON public.schedule_items FOR SELECT TO authenticated USING (public.current_user_has_business_access(business_id));


--
-- Name: schedule_items schedule_items_authenticated_write_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY schedule_items_authenticated_write_own_business ON public.schedule_items TO authenticated USING (public.current_user_has_business_access(business_id)) WITH CHECK (public.current_user_has_business_access(business_id));


--
-- Name: scheduled_emails; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;

--
-- Name: seo_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.seo_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

--
-- Name: services_content_backup_2026_03_01; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.services_content_backup_2026_03_01 ENABLE ROW LEVEL SECURITY;

--
-- Name: team_member_employment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_member_employment ENABLE ROW LEVEL SECURITY;

--
-- Name: team_member_employment team_member_employment_authenticated_read_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_member_employment_authenticated_read_own_business ON public.team_member_employment FOR SELECT TO authenticated USING (public.current_user_has_business_access(business_id));


--
-- Name: team_member_employment team_member_employment_authenticated_write_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_member_employment_authenticated_write_own_business ON public.team_member_employment TO authenticated USING (public.current_user_has_business_access(business_id)) WITH CHECK (public.current_user_has_business_access(business_id));


--
-- Name: team_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

--
-- Name: team_members team_members_authenticated_delete_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_members_authenticated_delete_own_business ON public.team_members FOR DELETE TO authenticated USING (public.current_user_has_business_access(business_id));


--
-- Name: team_members team_members_authenticated_insert_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_members_authenticated_insert_own_business ON public.team_members FOR INSERT TO authenticated WITH CHECK (public.current_user_has_business_access(business_id));


--
-- Name: team_members team_members_authenticated_update_own_business; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_members_authenticated_update_own_business ON public.team_members FOR UPDATE TO authenticated USING (public.current_user_has_business_access(business_id)) WITH CHECK (public.current_user_has_business_access(business_id));


--
-- Name: team_members team_members_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY team_members_public_read ON public.team_members FOR SELECT TO authenticated, anon USING (true);


--
-- Name: testimonials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

--
-- Name: user_business_access; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_business_access ENABLE ROW LEVEL SECURITY;

--
-- Name: user_business_access user_business_access_authenticated_read_own_rows; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_business_access_authenticated_read_own_rows ON public.user_business_access FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: zip_locations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.zip_locations ENABLE ROW LEVEL SECURITY;

--
-- Name: zip_locations zip_locations readable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "zip_locations readable by authenticated users" ON public.zip_locations FOR SELECT TO authenticated USING (true);


--
-- PostgreSQL database dump complete
--


