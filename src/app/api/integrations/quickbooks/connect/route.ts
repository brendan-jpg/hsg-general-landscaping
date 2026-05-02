import { Buffer } from 'node:buffer';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildQuickBooksAuthorizeUrl } from '@/lib/integrations/quickbooks';

function encodeState(payload: Record<string, string>) {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'));
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) {
    const redirectUrl = new URL('/dashboard/settings', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000');
    redirectUrl.searchParams.set('quickbooks', 'error');
    redirectUrl.searchParams.set('message', profileError.message);
    return NextResponse.redirect(redirectUrl);
  }
  if (!profile?.business_id) {
    const redirectUrl = new URL('/dashboard/settings', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000');
    redirectUrl.searchParams.set('quickbooks', 'error');
    redirectUrl.searchParams.set('message', 'Business context not found');
    return NextResponse.redirect(redirectUrl);
  }

  const state = encodeState({
    user_id: user.id,
    ts: String(Date.now()),
  });

  const authorizeUrl = await buildQuickBooksAuthorizeUrl(state, profile.business_id);
  return NextResponse.redirect(authorizeUrl);
}
