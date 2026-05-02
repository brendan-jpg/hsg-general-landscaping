import { createAdminClient } from '@/lib/supabase/admin';
import { isPlatformAdminEmail } from '@/lib/authz/dashboard';
import type { Tables } from '@/lib/types/database';

type ProfileRow = Pick<
  Tables<'profiles'>,
  'id' | 'business_id' | 'first_name' | 'last_name' | 'phone' | 'role' | 'is_active' | 'created_at'
>;

type BusinessAccessRow = Pick<
  Tables<'user_business_access'>,
  'user_id' | 'business_id' | 'role' | 'is_active' | 'created_at'
>;

export interface ManagedBusinessUser {
  id: string;
  business_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: Tables<'profiles'>['role'];
  is_active: boolean;
  created_at: string;
  email: string;
  is_platform_admin: boolean;
}

async function listAllAuthUsers() {
  const admin = createAdminClient();
  const users: Array<{ id: string; email: string }> = [];
  const perPage = 200;

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);

    const rows = (data?.users ?? [])
      .map((user) => ({
        id: user.id,
        email: user.email?.trim() ?? '',
      }))
      .filter((user) => user.id);

    users.push(...rows);
    if (rows.length < perPage) break;
  }

  return users;
}

export async function getManagedBusinessUsers(businessId: string): Promise<ManagedBusinessUser[]> {
  const admin = createAdminClient();
  const [{ data: accessRows, error: accessError }, authUsers] = await Promise.all([
    admin
      .from('user_business_access')
      .select('user_id, business_id, role, is_active, created_at')
      .eq('business_id', businessId)
      .order('role', { ascending: true })
      .order('created_at', { ascending: true }),
    listAllAuthUsers(),
  ]);

  if (accessError) throw new Error(accessError.message);

  const userIds = Array.from(
    new Set(((accessRows ?? []) as BusinessAccessRow[]).map((row) => row.user_id).filter(Boolean)),
  );

  const { data: profiles, error: profilesError } = userIds.length
    ? await admin
        .from('profiles')
        .select('id, business_id, first_name, last_name, phone, role, is_active, created_at')
        .in('id', userIds)
    : { data: [], error: null };

  if (profilesError) throw new Error(profilesError.message);

  const profileById = new Map(((profiles ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]));
  const emailById = new Map(authUsers.map((user) => [user.id, user.email]));
  return ((accessRows ?? []) as BusinessAccessRow[])
    .map((accessRow) => {
      const profile = profileById.get(accessRow.user_id);
      const email = emailById.get(accessRow.user_id) ?? '';
      return {
        id: accessRow.user_id,
        business_id: accessRow.business_id,
        first_name: profile?.first_name ?? null,
        last_name: profile?.last_name ?? null,
        phone: profile?.phone ?? null,
        role: accessRow.role,
        is_active: accessRow.is_active && (profile?.is_active ?? true),
        created_at: accessRow.created_at,
        email,
        is_platform_admin: isPlatformAdminEmail(email),
      };
    })
    .sort((a, b) => {
      if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
      return `${a.first_name ?? ''} ${a.last_name ?? ''}`.localeCompare(`${b.first_name ?? ''} ${b.last_name ?? ''}`);
    });
}
