import { Buffer } from 'node:buffer';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildGoogleBusinessProfileAuthorizeUrl } from '@/lib/integrations/googleBusinessProfile';

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

  const state = encodeState({
    user_id: user.id,
    ts: String(Date.now()),
  });

  return NextResponse.redirect(buildGoogleBusinessProfileAuthorizeUrl(state));
}
