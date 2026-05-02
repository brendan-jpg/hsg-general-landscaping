import { type NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-hsg-pathname', request.nextUrl.pathname);

  if (request.nextUrl.pathname === '/try-free' || request.nextUrl.pathname.startsWith('/try-free/')) {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  requestHeaders.forEach((value, key) => {
    request.headers.set(key, value);
  });
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - sitemap.xml, robots.txt
     * - public folder assets
     */
    '/((?!_next/static|_next/image|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
