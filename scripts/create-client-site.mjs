#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function formatErrorMessage(error) {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object') {
    const maybeMessage =
      typeof error.message === 'string'
        ? error.message
        : typeof error.error_description === 'string'
          ? error.error_description
          : null;
    if (maybeMessage) return maybeMessage;
    try {
      return JSON.stringify(error);
    } catch {}
  }
  return String(error);
}

function isMissingTableError(error, tableName) {
  const message = formatErrorMessage(error).toLowerCase();
  return message.includes(`could not find the table 'public.${String(tableName).toLowerCase()}'`);
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildClientThemeKey(slug) {
  const normalizedSlug = slugify(slug);
  return normalizedSlug ? `client-${normalizedSlug}-theme` : null;
}

async function getServicePreset(presetName, businessName) {
  if (!presetName) return null;

  if (presetName === 'general-landscaping') {
    let presetModule;
    try {
      presetModule = await import('../src/lib/content/generalLandscapingServicePageContent.ts');
    } catch {
      fail(
        'The "general-landscaping" preset is unavailable because ../src/lib/content/generalLandscapingServicePageContent.ts is missing.',
      );
    }
    const generalLandscapingContent = presetModule.GENERAL_LANDSCAPING_SERVICE_PAGE_CONTENT;
    if (!Array.isArray(generalLandscapingContent)) {
      fail('The "general-landscaping" preset content is invalid.');
    }

    return generalLandscapingContent.map((entry, index) => ({
      title: entry.title,
      slug: entry.slug,
      parentSlug: entry.parentSlug,
      content: entry.content,
      excerpt: `${businessName} provides professional ${entry.title.toLowerCase()} services with a focus on quality workmanship, clear planning, and reliable project execution.`,
      sortOrder: index,
    }));
  }

  fail(`Unknown service preset "${presetName}". Supported presets: general-landscaping`);
}

function getAreaPreset(presetName) {
  if (!presetName) return null;

  if (presetName === 'general-landscaping') {
    return ['Portland', 'Colchester', 'East Hampton', 'Marlborough', 'Hebron', 'Manchester', 'Glastonbury'];
  }

  fail(`Unknown service preset "${presetName}". Supported presets: general-landscaping`);
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
        section('hero', 'layout_marker'),
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
        section('hero', 'layout_marker'),
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

function blocksToRichTextSectionSeed(blocks, fallbackHeading) {
  if (!Array.isArray(blocks)) {
    return { heading: fallbackHeading || 'Overview', body: '' };
  }

  let heading = '';
  const parts = [];

  for (const block of blocks) {
    if (!block || typeof block !== 'object' || Array.isArray(block)) continue;
    const type = typeof block.type === 'string' ? block.type : '';
    const data = block.data && typeof block.data === 'object' && !Array.isArray(block.data) ? block.data : {};

    if (type === 'heading') {
      const text = typeof data.text === 'string' ? data.text.trim() : '';
      if (!text) continue;
      if (!heading) {
        heading = text;
        continue;
      }
      parts.push(text);
      continue;
    }

    if (type === 'paragraph') {
      const text = typeof data.text === 'string' ? data.text.trim() : '';
      if (text) parts.push(text);
      continue;
    }

    if (type === 'list') {
      const items = Array.isArray(data.items) ? data.items.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean) : [];
      if (items.length > 0) {
        parts.push(items.map((item) => `- ${item}`).join('\n'));
      }
      continue;
    }
  }

  return {
    heading: heading || fallbackHeading || 'Overview',
    body: parts.join('\n\n'),
  };
}

function injectBlocksIntoTemplateContentSection(templateKey, seed, blocks, fallbackHeading) {
  const content = createTemplatePageContent(templateKey, seed);
  if (!content || !Array.isArray(content.sections)) return content;

  const richText = blocksToRichTextSectionSeed(blocks, fallbackHeading);
  const targetSection = content.sections.find(
    (section) => section && section.slotId === 'content' && section.type === 'rich_text_section',
  );

  if (!targetSection) return content;

  targetSection.data = {
    ...(targetSection.data && typeof targetSection.data === 'object' && !Array.isArray(targetSection.data) ? targetSection.data : {}),
    heading: richText.heading,
    body: richText.body,
  };

  return content;
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

async function upsertAreaLink(supabase, areaId, serviceId, customContent = null) {
  const { data: existing, error: lookupError } = await supabase
    .from('area_services')
    .select('area_id, service_id')
    .eq('area_id', areaId)
    .eq('service_id', serviceId)
    .maybeSingle();
  if (lookupError) throw lookupError;

  if (existing) {
    const { error } = await supabase
      .from('area_services')
      .update({ is_active: true, custom_content: customContent })
      .eq('area_id', areaId)
      .eq('service_id', serviceId);
    if (error) throw error;
    return { created: false };
  }

  const { error } = await supabase.from('area_services').insert({
    area_id: areaId,
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
    fail('Usage: node scripts/create-client-site.mjs --name "Client Name" [--slug client-slug] [--domain example.com] [--admin-user-id <uuid>] [--service-preset general-landscaping]');
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
  const servicePreset = args['service-preset'] ? String(args['service-preset']).trim() : null;

  const locationLabel = [city, state].filter(Boolean).join(', ');

  const presetServices = await getServicePreset(servicePreset, name);
  const presetAreas = getAreaPreset(servicePreset);

  const plan = {
    business: {
      name,
      slug: businessSlug,
      theme_key: buildClientThemeKey(businessSlug),
      domain,
      email,
      phone,
      city,
      state,
      zip,
      timezone,
      theme_css: null,
      settings: {},
    },
    pages: [
      { slug: 'home', title: 'Home', template: null, show_in_nav: true },
      { slug: 'about', title: 'About', template: 'about-page-v1', show_in_nav: true },
      { slug: 'contact', title: 'Contact', template: 'contact-page-v1', show_in_nav: true },
    ],
    services: presetServices || ['General Contracting', 'Remodeling', 'Repairs'],
    Areas:
      presetAreas ||
      (locationLabel ? [locationLabel, `North ${city || 'Area'}`, `South ${city || 'Area'}`] : ['Primary Area']),
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
  const seededServiceIdBySlug = new Map();
  for (let index = 0; index < plan.services.length; index += 1) {
    const serviceItem = plan.services[index];
    const serviceName = typeof serviceItem === 'string' ? serviceItem : serviceItem.title;
    const serviceSlug = typeof serviceItem === 'string' ? slugify(serviceItem) : serviceItem.slug;
    const content =
      typeof serviceItem === 'string'
        ? createTemplatePageContent('service-content-v1', {
            serviceName,
            serviceHeading: `${serviceName} Services`,
          })
        : injectBlocksIntoTemplateContentSection(
            'service-content-v1',
            {
              serviceName,
              serviceHeading: `${serviceName} Services`,
            },
            serviceItem.content,
            `${serviceName} Services`,
          );
    let parentServiceId = null;
    if (typeof serviceItem !== 'string' && serviceItem.parentSlug) {
      parentServiceId = seededServiceIdBySlug.get(serviceItem.parentSlug) || null;
      if (!parentServiceId) {
        fail(`Unable to resolve parent service "${serviceItem.parentSlug}" for "${serviceSlug}". Check service order in the preset.`);
      }
    }
    const excerpt =
      typeof serviceItem === 'string'
        ? `${name} provides ${serviceName.toLowerCase()} services${locationLabel ? ` in ${locationLabel}` : ''}.`
        : serviceItem.excerpt || `${name} provides professional ${serviceName.toLowerCase()} services.`;
    const sortOrder = typeof serviceItem === 'string' ? index : (serviceItem.sortOrder ?? index);

    const result = await upsertByBusinessSlug(
      supabase,
      'services',
      businessId,
      serviceSlug,
      {
        business_id: businessId,
        title: serviceName,
        slug: serviceSlug,
        excerpt,
        content,
        sort_order: sortOrder,
        parent_service_id: parentServiceId,
        is_active: true,
        before_after_groups: [],
        service_projects: [],
        meta_title: `${serviceName} | ${name}`,
        meta_description: null,
      },
      'id, slug, title',
    );
    seededServices.push(result);
    seededServiceIdBySlug.set(serviceSlug, result.id);
  }

  const seededAreas = [];
  let createdLinks = 0;
  let updatedLinks = 0;
  for (let index = 0; index < plan.Areas.length; index += 1) {
    const areaItem = plan.Areas[index];
    const areaName = typeof areaItem === 'string' ? areaItem : areaItem.name;
    const areaSlug = typeof areaItem === 'string' ? slugify(areaItem) : areaItem.slug || slugify(areaItem.name);
    const content =
      typeof areaItem === 'string'
        ? createTemplatePageContent('area-content-v1', { areaName })
        : Array.isArray(areaItem.content)
          ? injectBlocksIntoTemplateContentSection(
              'area-content-v1',
              { areaName, areaHeading: `Services in ${areaName}` },
              areaItem.content,
              `Services in ${areaName}`,
            )
          : createTemplatePageContent('area-content-v1', { areaName });

    const result = await upsertByBusinessSlug(
      supabase,
      'areas',
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

  let canSeedAreaLinks = true;
  for (const area of seededAreas) {
    for (const service of seededServices) {
      if (!canSeedAreaLinks) break;
      try {
        const linkResult = await upsertAreaLink(supabase, area.id, service.id);
        if (linkResult.created) createdLinks += 1;
        else updatedLinks += 1;
      } catch (error) {
        if (isMissingTableError(error, 'area_services') || isMissingTableError(error, 'service_area_services')) {
          canSeedAreaLinks = false;
          createdLinks = 0;
          updatedLinks = 0;
          break;
        }
        throw error;
      }
    }
    if (!canSeedAreaLinks) break;
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
  fail(formatErrorMessage(error));
});
