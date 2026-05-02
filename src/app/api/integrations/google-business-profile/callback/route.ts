import { Buffer } from 'node:buffer';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  discoverGoogleBusinessProfileConnection,
  exchangeGoogleBusinessProfileAuthorizationCode,
  saveGoogleBusinessProfileSettingsForBusiness,
} from '@/lib/integrations/googleBusinessProfile';

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
  const state = decodeState(request.nextUrl.searchParams.get('state'));
  const oauthError = request.nextUrl.searchParams.get('error')?.trim();

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = '/dashboard/settings';
  redirectUrl.search = '';
  redirectUrl.searchParams.set('tab', 'business');

  if (oauthError) {
    redirectUrl.searchParams.set('google', 'error');
    redirectUrl.searchParams.set('google_message', oauthError);
    return NextResponse.redirect(redirectUrl);
  }

  if (!code) {
    redirectUrl.searchParams.set('google', 'error');
    redirectUrl.searchParams.set('google_message', 'Missing Google callback code');
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
    redirectUrl.searchParams.set('google', 'error');
    redirectUrl.searchParams.set('google_message', 'Invalid Google OAuth state');
    return NextResponse.redirect(redirectUrl);
  }
  if (state?.ts) {
    const stateMs = Number(state.ts);
    const isStale = !Number.isFinite(stateMs) || Math.abs(Date.now() - stateMs) > 15 * 60 * 1000;
    if (isStale) {
      redirectUrl.searchParams.set('google', 'error');
      redirectUrl.searchParams.set('google_message', 'Google OAuth state expired');
      return NextResponse.redirect(redirectUrl);
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) {
    redirectUrl.searchParams.set('google', 'error');
    redirectUrl.searchParams.set('google_message', profileError.message);
    return NextResponse.redirect(redirectUrl);
  }
  if (!profile?.business_id) {
    redirectUrl.searchParams.set('google', 'error');
    redirectUrl.searchParams.set('google_message', 'Business context not found');
    return NextResponse.redirect(redirectUrl);
  }

  try {
    const token = await exchangeGoogleBusinessProfileAuthorizationCode(code);
    const discovered = await discoverGoogleBusinessProfileConnection(token.accessToken);
    await saveGoogleBusinessProfileSettingsForBusiness({
      businessId: profile.business_id,
      refreshToken: token.refreshToken,
      accountId: discovered.accountId,
      locationId: discovered.locationId,
    });

    redirectUrl.searchParams.set('google', 'connected');
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    redirectUrl.searchParams.set('google', 'error');
    redirectUrl.searchParams.set(
      'google_message',
      error instanceof Error ? error.message : 'Google Business Profile connection failed',
    );
    return NextResponse.redirect(redirectUrl);
  }
}
