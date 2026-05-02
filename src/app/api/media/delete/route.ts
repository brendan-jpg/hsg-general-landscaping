import { NextResponse } from 'next/server';
import { getCurrentDashboardBusinessId } from '@/lib/authz/dashboard';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMediaRoleFromMetadata } from '@/lib/media/roles';
import type { Json } from '@/lib/types/database';

export const runtime = 'nodejs';

function getStorageObjectPathFromPublicUrl(fileUrl: string, bucket: string) {
  try {
    const url = new URL(fileUrl);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const index = url.pathname.indexOf(marker);
    if (index === -1) return null;
    return decodeURIComponent(url.pathname.slice(index + marker.length));
  } catch {
    return null;
  }
}

async function getAuthenticatedDeleteContext() {
  const businessId = await getCurrentDashboardBusinessId();
  if (!businessId) throw new Error('No business is associated with this user.');
  return { businessId };
}

async function syncBusinessBrandAssetUrl(
  businessId: string,
  role: 'logo' | 'icon',
  fileUrl: string | null,
) {
  const admin = createAdminClient();

  if (role === 'logo') {
    const { error } = await admin.from('businesses').update({ logo_url: fileUrl }).eq('id', businessId);
    if (error) throw new Error(error.message);
    return;
  }

  const { data: business, error: businessError } = await admin
    .from('businesses')
    .select('settings')
    .eq('id', businessId)
    .maybeSingle();
  if (businessError) throw new Error(businessError.message);

  const settings =
    business?.settings && typeof business.settings === 'object' && !Array.isArray(business.settings)
      ? { ...(business.settings as Record<string, unknown>) }
      : {};
  settings.favicon_url = fileUrl;

  const { error: updateError } = await admin.from('businesses').update({ settings: settings as Json }).eq('id', businessId);
  if (updateError) throw new Error(updateError.message);
}

async function getLatestBrandAssetUrl(businessId: string, role: 'logo' | 'icon') {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('media')
    .select('file_url, metadata, created_at')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(120);

  if (error) throw new Error(error.message);

  const row = (data ?? []).find((item) => getMediaRoleFromMetadata(item.metadata) === role);
  return row?.file_url ?? null;
}

export async function POST(request: Request) {
  try {
    const { businessId } = await getAuthenticatedDeleteContext();
    const payload = (await request.json()) as { ids?: unknown };
    const ids = Array.isArray(payload.ids)
      ? payload.ids.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: 'No media items selected.' }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: targetItems, error: targetError } = await admin
      .from('media')
      .select('id, file_url, folder, metadata')
      .eq('business_id', businessId)
      .in('id', ids);
    if (targetError) throw new Error(targetError.message);

    const items = targetItems ?? [];
    if (items.length === 0) {
      return NextResponse.json({ deletedIds: [] });
    }

    const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'media';
    const objectPaths = new Set<string>();

    for (const item of items) {
      if (item.folder) {
        const { data: listed, error: listError } = await admin.storage.from(bucket).list(item.folder, {
          limit: 200,
          sortBy: { column: 'name', order: 'asc' },
        });
        if (listError) throw new Error(listError.message);
        for (const entry of listed ?? []) {
          if (!entry.name) continue;
          objectPaths.add(`${item.folder}/${entry.name}`);
        }
      }

      const primaryPath = getStorageObjectPathFromPublicUrl(item.file_url, bucket);
      if (primaryPath) objectPaths.add(primaryPath);
    }

    if (objectPaths.size > 0) {
      const { error: storageError } = await admin.storage.from(bucket).remove([...objectPaths]);
      if (storageError) throw new Error(storageError.message);
    }

    const { error: deleteError } = await admin.from('media').delete().in('id', items.map((item) => item.id));
    if (deleteError) throw new Error(deleteError.message);

    const deletedRoles = new Set(
      items
        .map((item) => getMediaRoleFromMetadata(item.metadata))
        .filter((value): value is 'logo' | 'icon' => value === 'logo' || value === 'icon'),
    );

    for (const role of deletedRoles) {
      const replacementUrl = await getLatestBrandAssetUrl(businessId, role);
      await syncBusinessBrandAssetUrl(businessId, role, replacementUrl);
    }

    return NextResponse.json({ deletedIds: items.map((item) => item.id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Delete failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
