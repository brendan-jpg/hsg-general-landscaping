import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Enums, TablesInsert } from '@/lib/types/database';

export const runtime = 'nodejs';

type AnalyticsEventType = Enums<'analytics_event_type'>;

type AnalyticsRequestBody = {
  eventType?: AnalyticsEventType;
  pageUrl?: string;
  referrer?: string;
  sessionId?: string;
  deviceType?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
};

const ALLOWED_EVENTS: AnalyticsEventType[] = [
  'page_view',
  'form_start',
  'form_submit',
  'cta_click',
  'phone_click',
];

function normalizeHost(value: string | null | undefined) {
  if (!value) return '';
  const first = value.split(',')[0]?.trim() ?? '';
  const withoutPath = first.split('/')[0] ?? first;
  return withoutPath
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/:\d+$/, '')
    .replace(/\/+$/, '');
}

async function getBusinessIdForRequest(request: Request) {
  const admin = createAdminClient();
  const requestUrl = new URL(request.url);
  const requestHost =
    normalizeHost(request.headers.get('x-forwarded-host')) ||
    normalizeHost(request.headers.get('host')) ||
    normalizeHost(requestUrl.host);

  if (requestHost) {
    const { data, error } = await admin
      .from('business_domains')
      .select('business_id')
      .eq('domain', requestHost)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data?.business_id) {
      return data.business_id;
    }

    const { data: business, error: businessError } = await admin
      .from('businesses')
      .select('id')
      .eq('domain', requestHost)
      .maybeSingle();

    if (businessError) throw new Error(businessError.message);
    if (business?.id) return business.id;
  }

  const envBusinessId = process.env.BUSINESS_ID?.trim();
  if (envBusinessId && ['localhost', '127.0.0.1', '[::1]'].includes(requestHost)) {
    const { data, error } = await admin
      .from('businesses')
      .select('id')
      .eq('id', envBusinessId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data?.id) return data.id;
  }

  throw new Error(`No business found for analytics event host: ${requestHost || '(unknown)'}`);
}

function sanitizeText(value?: string | null, maxLength = 255) {
  if (!value) return null;
  return value.trim().slice(0, maxLength) || null;
}

function sanitizePageUrl(value?: string) {
  return sanitizeText(value, 2048);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalyticsRequestBody;

    if (!body?.eventType || !ALLOWED_EVENTS.includes(body.eventType)) {
      return NextResponse.json({ error: 'Invalid event type' }, { status: 400 });
    }

    const businessId = await getBusinessIdForRequest(request);
    const admin = createAdminClient();

    const row: TablesInsert<'analytics_events'> = {
      business_id: businessId,
      event_type: body.eventType,
      page_url: sanitizePageUrl(body.pageUrl),
      referrer: sanitizeText(body.referrer, 2048),
      session_id: sanitizeText(body.sessionId, 128),
      device_type: sanitizeText(body.deviceType, 32),
      utm_source: sanitizeText(body.utmSource, 128),
      utm_medium: sanitizeText(body.utmMedium, 128),
      utm_campaign: sanitizeText(body.utmCampaign, 128),
    };

    const { error } = await admin.from('analytics_events').insert(row);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to track event' }, { status: 500 });
  }
}
