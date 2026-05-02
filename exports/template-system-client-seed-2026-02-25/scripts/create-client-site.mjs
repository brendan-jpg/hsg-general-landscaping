#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function createTemplatePageContent(templateKey, seed = {}) {
  const section = (slotId, type, data = {}, hidden = false) => ({
    id: `seed-${slotId}-${Math.random().toString(36).slice(2, 8)}`,
    slotId,
    type,
    hidden,
    data,
  });

  if (templateKey === 'about-page-v1') {
    return {
      kind: 'template-page',
      version: 1,
      templateKey,
      sections: [
        section('page_header', 'layout_marker'),
        section('company_overview_content', 'rich_text_section', {
          heading: 'About Our Company',
          body:
            seed.aboutBody ||
            `We serve ${seed.locationLabel || 'our local area'} with a focus on communication, reliability, and quality workmanship. Every project starts with clear expectations and ends with a clean, professional result.`,
        }),
        section('owner_spotlight', 'layout_marker'),
        section('team_grid', 'layout_marker'),
      ],
    };
  }

  if (templateKey === 'contact-page-v1') {
    return {
      kind: 'template-page',
      version: 1,
      templateKey,
      sections: [
        section('page_header', 'layout_marker'),
        section(
          'contact_intro_content',
          'rich_text_section',
          {
            heading: 'How To Reach Us',
            body:
              seed.contactBody ||
              'Tell us about your project and we will follow up with the next steps, scheduling options, and any information we need for an accurate quote.',
          },
          false,
        ),
        section('contact_form_section', 'layout_marker'),
      ],
    };
  }

  if (templateKey === 'service-content-v1') {
    return {
      kind: 'template-page',
      version: 1,
      templateKey,
      sections: [
        section('hero', 'layout_marker'),
        section('intro', 'layout_marker'),
        section('content', 'rich_text_section', {
          heading: seed.serviceHeading || 'Service Overview',
          body:
            seed.serviceBody ||
            `We provide professional ${String(seed.serviceName || 'service').toLowerCase()} with clear communication, dependable scheduling, and workmanship you can trust.`,
        }),
        section('content_cta', 'cta_band', {
          heading: `Need ${seed.serviceName || 'Service'}?`,
          body: 'Request a quote and we will help you plan the next steps.',
          cta: { text: 'Request a Quote', href: '/contact' },
        }, true),
        section('process', 'layout_marker'),
        section('related_services', 'layout_marker'),
        section('related_articles', 'layout_marker'),
        section('related_reviews', 'layout_marker'),
        section('related_faqs', 'layout_marker'),
        section('projects', 'layout_marker'),
        section('gallery', 'layout_marker'),
        section('before_after', 'layout_marker'),
        section('related_areas', 'layout_marker'),
      ],
    };
  }

  if (templateKey === 'area-content-v1') {
    return {
      kind: 'template-page',
      version: 1,
      templateKey,
      sections: [
        section('hero', 'layout_marker'),
        section('intro', 'layout_marker'),
        section('content', 'rich_text_section', {
          heading: seed.areaHeading || `Services in ${seed.areaName || 'Your Area'}`,
          body:
            seed.areaBody ||
            `We provide reliable service across ${seed.areaName || 'this area'}, with local scheduling, clear communication, and project support from quote to completion.`,
        }),
        section('content_cta', 'cta_band', {
          heading: `Serving ${seed.areaName || 'Your Area'}`,
          body: 'Contact us to confirm availability and schedule your project.',
          cta: { text: 'Contact Us', href: '/contact' },
        }, true),
        section('process', 'layout_marker'),
        section('related_reviews', 'layout_marker'),
        section('related_faqs', 'layout_marker'),
        section('related_articles', 'layout_marker'),
        section('area_projects', 'layout_marker'),
        section('gallery', 'layout_marker'),
        section('before_after', 'layout_marker'),
        section('related_services', 'layout_marker'),
      ],
    };
  }

  return {
    kind: 'template-page',
    version: 1,
    templateKey: 'content-page-v1',
    sections: [],
  };
}

async function upsertBusiness(supabase, payload) {
  const { data: existing, error: lookupError } = await supabase
    .from('businesses')
    .select('id, slug')
    .eq('slug', payload.slug)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existing) {
    const { data, error } = await supabase
      .from('businesses')
      .update(payload)
      .eq('id', existing.id)
      .select('id, slug')
      .single();
    if (error) throw error;
    return { ...data, created: false };
  }

  const { data, error } = await supabase
    .from('businesses')
    .insert(payload)
    .select('id, slug')
    .single();
  if (error) throw error;
  return { ...data, created: true };
}

async function upsertByBusinessSlug(supabase, table, businessId, slug, payload, selectCols = 'id, slug') {
  const { data: existing, error: lookupError } = await supabase
    .from(table)
    .select('id')
    .eq('business_id', businessId)
    .eq('slug', slug)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existing) {
    const { data, error } = await supabase
      .from(table)
      .update(payload)
      .eq('id', existing.id)
      .select(selectCols)
      .single();
    if (error) throw error;
    return { ...data, created: false };
  }

  const { data, error } = await supabase
    .from(table)
    .insert(payload)
    .select(selectCols)
    .single();
  if (error) throw error;
  return { ...data, created: true };
}

async function upsertAreaLink(supabase, AreaId, serviceId, customContent = null) {
  const { data: existing, error: lookupError } = await supabase
    .from('service_area_services')
    .select('service_area_id, service_id')
    .eq('service_area_id', AreaId)
    .eq('service_id', serviceId)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existing) {
    const { error } = await supabase
      .from('service_area_services')
      .update({ is_active: true, custom_content: customContent })
      .eq('service_area_id', AreaId)
      .eq('service_id', serviceId);
    if (error) throw error;
    return { created: false };
  }

  const { error } = await supabase.from('service_area_services').insert({
    service_area_id: AreaId,
    service_id: serviceId,
    is_active: true,
    custom_content: customContent,
  });
  if (error) throw error;
  return { created: true };
}

async function attachAdminProfile(supabase, businessId, userId) {
  const { data: existing, error: lookupError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (!existing) {
    throw new Error(`No profile found for user id ${userId}`);
  }

  const { error } = await supabase
    .from('profiles')
    .update({ business_id: businessId, role: 'admin', is_active: true })
    .eq('id', userId);
  if (error) throw error;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const name = String(args.name || '').trim();
  if (!name) {
    fail('Usage: node scripts/create-client-site.mjs --name "Client Name" [--slug client-slug] [--domain example.com] [--admin-user-id <uuid>]');
  }

  const businessSlug = slugify(args.slug || name);
  if (!businessSlug) fail('Invalid business slug');

  const dryRun = Boolean(args['dry-run']);
  const timezone = String(args.timezone || 'America/New_York');
  const city = args.city ? String(args.city).trim() : null;
  const state = args.state ? String(args.state).trim() : null;
  const zip = args.zip ? String(args.zip).trim() : null;
  const domain = args.domain ? String(args.domain).trim() : null;
  const email = args.email ? String(args.email).trim() : null;
  const phone = args.phone ? String(args.phone).trim() : null;
  const adminUserId = args['admin-user-id'] ? String(args['admin-user-id']).trim() : null;

  const locationLabel = [city, state].filter(Boolean).join(', ');

  const plan = {
    business: {
      name,
      slug: businessSlug,
      domain,
      email,
      phone,
      city,
      state,
      zip,
      timezone,
      settings: {},
    },
    pages: [
      { slug: 'home', title: 'Home', template: null, show_in_nav: true },
      { slug: 'about', title: 'About', template: 'about-page-v1', show_in_nav: true },
      { slug: 'contact', title: 'Contact', template: 'contact-page-v1', show_in_nav: true },
    ],
    services: ['General Contracting', 'Remodeling', 'Repairs'],
    Areas: locationLabel ? [locationLabel, `North ${city || 'Area'}`, `South ${city || 'Area'}`] : ['Primary Area'],
    attachAdminUserId: adminUserId,
  };

  if (dryRun) {
    console.log(JSON.stringify(plan, null, 2));
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) fail('Missing NEXT_PUBLIC_SUPABASE_URL');
  if (!serviceKey) fail('Missing SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY)');

  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const business = await upsertBusiness(supabase, plan.business);
  const businessId = business.id;

  const seededPages = [];
  for (let index = 0; index < plan.pages.length; index += 1) {
    const page = plan.pages[index];
    const content = page.template
      ? createTemplatePageContent(page.template, {
          locationLabel,
          aboutBody: args['about-body'],
          contactBody: args['contact-body'],
        })
      : [];

    const result = await upsertByBusinessSlug(
      supabase,
      'pages',
      businessId,
      page.slug,
      {
        business_id: businessId,
        title: page.title,
        slug: page.slug,
        show_in_nav: page.show_in_nav,
        sort_order: index,
        content,
        meta_title: page.slug === 'home' ? `${name} | Home` : `${page.title} | ${name}`,
        meta_description: null,
      },
      'id, slug, title',
    );
    seededPages.push(result);
  }

  const seededServices = [];
  for (let index = 0; index < plan.services.length; index += 1) {
    const serviceName = plan.services[index];
    const serviceSlug = slugify(serviceName);
    const content = createTemplatePageContent('service-content-v1', {
      serviceName,
      serviceHeading: `${serviceName} Services`,
    });

    const result = await upsertByBusinessSlug(
      supabase,
      'services',
      businessId,
      serviceSlug,
      {
        business_id: businessId,
        title: serviceName,
        slug: serviceSlug,
        excerpt: `${name} provides ${serviceName.toLowerCase()} services${locationLabel ? ` in ${locationLabel}` : ''}.`,
        content,
        sort_order: index,
        is_active: true,
        is_featured: index < 3,
        before_gallery_urls: [],
        after_gallery_urls: [],
        before_after_groups: [],
        service_projects: [],
        meta_title: `${serviceName} | ${name}`,
        meta_description: null,
      },
      'id, slug, title',
    );
    seededServices.push(result);
  }

  const seededAreas = [];
  for (let index = 0; index < plan.Areas.length; index += 1) {
    const areaName = plan.Areas[index];
    const areaSlug = slugify(areaName);
    const content = createTemplatePageContent('area-content-v1', { areaName });

    const result = await upsertByBusinessSlug(
      supabase,
      'service_areas',
      businessId,
      areaSlug,
      {
        business_id: businessId,
        name: areaName,
        slug: areaSlug,
        content,
        is_active: true,
        meta_title: `${areaName} Services | ${name}`,
        meta_description: null,
      },
      'id, slug, name',
    );
    seededAreas.push(result);
  }

  let createdLinks = 0;
  let updatedLinks = 0;
  for (const area of seededAreas) {
    for (const service of seededServices) {
      const result = await upsertAreaLink(supabase, area.id, service.id, null);
      if (result.created) createdLinks += 1;
      else updatedLinks += 1;
    }
  }

  if (adminUserId) {
    await attachAdminProfile(supabase, businessId, adminUserId);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        business: { id: businessId, slug: business.slug, created: business.created },
        pages: {
          total: seededPages.length,
          created: seededPages.filter((row) => row.created).length,
          updated: seededPages.filter((row) => !row.created).length,
        },
        services: {
          total: seededServices.length,
          created: seededServices.filter((row) => row.created).length,
          updated: seededServices.filter((row) => !row.created).length,
        },
        Areas: {
          total: seededAreas.length,
          created: seededAreas.filter((row) => row.created).length,
          updated: seededAreas.filter((row) => !row.created).length,
        },
        AreaLinks: { created: createdLinks, updated: updatedLinks },
        adminProfileAttached: Boolean(adminUserId),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
