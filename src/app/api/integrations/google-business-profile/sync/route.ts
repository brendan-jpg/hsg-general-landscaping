import { NextRequest, NextResponse } from 'next/server';
import { syncGoogleBusinessProfileReviews } from '@/lib/integrations/googleBusinessProfile';

function isAuthorized(request: NextRequest) {
  const configuredSecrets = [
    process.env.GOOGLE_BUSINESS_PROFILE_SYNC_SECRET?.trim(),
    process.env.CRON_SECRET?.trim(),
  ].filter((value): value is string => Boolean(value));
  if (configuredSecrets.length === 0) return process.env.NODE_ENV !== 'production';

  const authHeader = request.headers.get('authorization');
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const querySecret = request.nextUrl.searchParams.get('secret')?.trim();
  const headerSecret = request.headers.get('x-sync-secret')?.trim();

  return configuredSecrets.some(
    (secret) =>
      bearer === secret || querySecret === secret || headerSecret === secret
  );
}

async function handleSync(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let businessId = request.nextUrl.searchParams.get('business_id')?.trim() || undefined;

    if (request.method === 'POST') {
      try {
        const body = (await request.json()) as { business_id?: unknown };
        if (typeof body.business_id === 'string' && body.business_id.trim()) {
          businessId = body.business_id.trim();
        }
      } catch {
        // Ignore non-JSON payloads; query params still work.
      }
    }

    const result = await syncGoogleBusinessProfileReviews({ businessId });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Sync failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleSync(request);
}

export async function POST(request: NextRequest) {
  return handleSync(request);
}
