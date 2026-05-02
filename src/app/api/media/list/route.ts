import { NextResponse } from 'next/server';
import { getCurrentDashboardBusinessId } from '@/lib/authz/dashboard';
import { createClient as createServerClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

async function getAuthenticatedBusinessId() {
  const businessId = await getCurrentDashboardBusinessId();
  if (!businessId) throw new Error('No business is associated with this user.');
  return businessId;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limitParam = Number(url.searchParams.get('limit') ?? '25');
    const offsetParam = Number(url.searchParams.get('offset') ?? '0');
    const imagesOnly = url.searchParams.get('imagesOnly') !== 'false';
    const roleParam = (url.searchParams.get('role') ?? '').trim().toLowerCase();
    const roleFilter = roleParam === 'logo' || roleParam === 'icon' ? roleParam : 'all';

    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(Math.trunc(limitParam), 1), 100) : 25;
    const offset = Number.isFinite(offsetParam) ? Math.max(Math.trunc(offsetParam), 0) : 0;

    const businessId = await getAuthenticatedBusinessId();
    const supabase = await createServerClient();

    let query = supabase
      .from('media')
      .select('*', { count: 'exact' })
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (imagesOnly) {
      query = query.like('file_type', 'image/%');
    }
    if (roleFilter === 'logo' || roleFilter === 'icon') {
      query = query.filter('metadata->>role', 'eq', roleFilter);
    }

    const { data, error, count } = await query;
    if (error) throw new Error(error.message);

    const items = data ?? [];
    const total = count ?? items.length;

    return NextResponse.json({
      items,
      offset,
      limit,
      total,
      hasMore: offset + items.length < total,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load media';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
