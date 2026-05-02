'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import type { Enums } from '@/lib/types/database';

type AnalyticsEventType = Enums<'analytics_event_type'>;

type AnalyticsPayload = {
  eventType: AnalyticsEventType;
  pageUrl?: string;
  referrer?: string;
  sessionId?: string;
  deviceType?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
};

const SESSION_STORAGE_KEY = 'hsg_analytics_session_id';

function sanitizePageUrl(pathname: string, search?: string) {
  const rawPathname = pathname.trim() || '/';
  const query = (search ?? '').replace(/^\?/, '');
  if (!query) return rawPathname;

  const params = new URLSearchParams(query);
  const kept = new URLSearchParams();
  for (const [key, value] of params.entries()) {
    if (key.toLowerCase().startsWith('utm_')) continue;
    if (['fbclid', 'gclid', 'gbraid', 'wbraid', 'mc_cid', 'mc_eid', '_hsenc', '_hsmi'].includes(key.toLowerCase())) continue;
    kept.append(key, value);
  }

  const nextQuery = kept.toString();
  return nextQuery ? `${rawPathname}?${nextQuery}` : rawPathname;
}

function getSessionId() {
  if (typeof window === 'undefined') return undefined;

  const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) return existing;

  const sessionId = crypto.randomUUID();
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  return sessionId;
}

function getDeviceType() {
  if (typeof window === 'undefined') return undefined;
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

function postAnalytics(payload: AnalyticsPayload) {
  const body = JSON.stringify(payload);

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([body], { type: 'application/json' });
    navigator.sendBeacon('/api/analytics', blob);
    return;
  }

  void fetch('/api/analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  });
}

export function trackEvent(eventType: Exclude<AnalyticsEventType, 'page_view'>) {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  postAnalytics({
    eventType,
    pageUrl: sanitizePageUrl(url.pathname, url.search),
    referrer: document.referrer || undefined,
    sessionId: getSessionId(),
    deviceType: getDeviceType(),
    utmSource: url.searchParams.get('utm_source') ?? undefined,
    utmMedium: url.searchParams.get('utm_medium') ?? undefined,
    utmCampaign: url.searchParams.get('utm_campaign') ?? undefined,
  });
}

export default function NativeAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    const query = typeof window !== 'undefined' ? window.location.search.replace(/^\?/, '') : '';
    const params = new URLSearchParams(query);
    const pageUrl = sanitizePageUrl(pathname, query ? `?${query}` : '');

    postAnalytics({
      eventType: 'page_view',
      pageUrl,
      referrer: document.referrer || undefined,
      sessionId: getSessionId(),
      deviceType: getDeviceType(),
      utmSource: params.get('utm_source') ?? undefined,
      utmMedium: params.get('utm_medium') ?? undefined,
      utmCampaign: params.get('utm_campaign') ?? undefined,
    });
  }, [pathname]);

  return null;
}
