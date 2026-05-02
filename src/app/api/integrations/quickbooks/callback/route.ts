import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  exchangeQuickBooksAuthorizationCode,
  runInitialQuickBooksSyncForBusiness,
  upsertQuickBooksConnection,
} from '@/lib/integrations/quickbooks';

function decodeState(raw: string | null) {
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    return JSON.parse(json) as { user_id?: string; ts?: string };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')?.trim();
  const realmId = request.nextUrl.searchParams.get('realmId')?.trim();
  const state = decodeState(request.nextUrl.searchParams.get('state'));
  const oauthError = request.nextUrl.searchParams.get('error')?.trim();

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = '/dashboard/settings';
  redirectUrl.search = '';

  if (oauthError) {
    redirectUrl.searchParams.set('quickbooks', 'error');
    redirectUrl.searchParams.set('message', oauthError);
    return NextResponse.redirect(redirectUrl);
  }

  if (!code || !realmId) {
    redirectUrl.searchParams.set('quickbooks', 'error');
    redirectUrl.searchParams.set('message', 'Missing QuickBooks callback parameters');
    return NextResponse.redirect(redirectUrl);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    return NextResponse.redirect(loginUrl);
  }

  if (state?.user_id && state.user_id !== user.id) {
    redirectUrl.searchParams.set('quickbooks', 'error');
    redirectUrl.searchParams.set('message', 'Invalid QuickBooks OAuth state');
    return NextResponse.redirect(redirectUrl);
  }
  if (state?.ts) {
    const stateMs = Number(state.ts);
    const isStale = !Number.isFinite(stateMs) || Math.abs(Date.now() - stateMs) > 15 * 60 * 1000;
    if (isStale) {
      redirectUrl.searchParams.set('quickbooks', 'error');
      redirectUrl.searchParams.set('message', 'QuickBooks OAuth state expired');
      return NextResponse.redirect(redirectUrl);
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) {
    redirectUrl.searchParams.set('quickbooks', 'error');
    redirectUrl.searchParams.set('message', profileError.message);
    return NextResponse.redirect(redirectUrl);
  }
  if (!profile?.business_id) {
    redirectUrl.searchParams.set('quickbooks', 'error');
    redirectUrl.searchParams.set('message', 'Business context not found');
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const tokenPatch = await exchangeQuickBooksAuthorizationCode(code, profile.business_id);
    await upsertQuickBooksConnection(profile.business_id, realmId, tokenPatch);
    const syncResult = await runInitialQuickBooksSyncForBusiness(profile.business_id);
    redirectUrl.searchParams.set('quickbooks', 'connected');
    redirectUrl.searchParams.set(
      'message',
      syncResult.lastError
        ? 'QuickBooks connected. Initial sync finished with some issues.'
        : 'QuickBooks connected and initial sync completed.',
    );
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    redirectUrl.searchParams.set('quickbooks', 'error');
    redirectUrl.searchParams.set(
      'message',
      error instanceof Error ? error.message : 'QuickBooks connection failed',
    );
    return NextResponse.redirect(redirectUrl);
  }
}
