import { cache } from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export type DashboardRole = 'admin' | 'employee';
type LegacyRole = 'owner' | 'admin' | 'editor' | 'technician' | null | undefined;

export function normalizeDashboardRole(role: LegacyRole): DashboardRole {
  if (role === 'owner' || role === 'admin') return 'admin';
  return 'employee';
}

export function isAdminDashboardRole(role: LegacyRole): boolean {
  return normalizeDashboardRole(role) === 'admin';
}

async function resolveLocalDevelopmentBusinessId() {
  const envBusinessId = process.env.BUSINESS_ID?.trim();
  if (!envBusinessId) return null;

  const requestHeaders = await headers();
  const host = normalizeHost(requestHeaders.get('x-forwarded-host') || requestHeaders.get('host'));
  if (!host || !isPlatformHost(host)) return null;

  return envBusinessId;
}

async function resolveRequestBusinessIdFromHost() {
  const requestHeaders = await headers();
  const host = normalizeHost(requestHeaders.get('x-forwarded-host') || requestHeaders.get('host'));
  if (!host || host === 'localhost' || host === '127.0.0.1' || host === '[::1]') {
    return null;
  }

  const admin = createAdminClient();
  const { data: domainEntry, error: domainError } = await admin
    .from('business_domains')
    .select('business_id')
    .eq('domain', host)
    .eq('is_active', true)
    .maybeSingle();
  if (domainError) throw new Error(domainError.message);
  if (domainEntry?.business_id) return domainEntry.business_id;

  const { data: business, error: businessError } = await admin
    .from('businesses')
    .select('id')
    .eq('domain', host)
    .maybeSingle();
  if (businessError) throw new Error(businessError.message);
  return business?.id ?? null;
}

async function grantPlatformAdminAccessToBusiness(userId: string, businessId: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from('user_business_access')
    .upsert(
      {
        user_id: userId,
        business_id: businessId,
        role: 'admin',
        is_active: true,
      },
      { onConflict: 'user_id,business_id' },
    );
  if (error) throw new Error(error.message);
}

async function syncPlatformAdminBusinessContext(options: {
  userId: string;
  email: string | null | undefined;
  currentBusinessId: string;
}) {
  if (!isPlatformAdminEmail(options.email)) return options.currentBusinessId;

  const hostBusinessId = await resolveRequestBusinessIdFromHost();
  if (!hostBusinessId) return options.currentBusinessId;
  await grantPlatformAdminAccessToBusiness(options.userId, hostBusinessId);

  return hostBusinessId;
}

export const getCurrentDashboardProfile = cache(async function getCurrentDashboardProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, business_id, first_name, last_name, role, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!profile) return null;
  if (!profile.is_active) return null;

  const localDevelopmentBusinessId = await resolveLocalDevelopmentBusinessId();
  if (localDevelopmentBusinessId) {
    if (isPlatformAdminEmail(user.email)) {
      await grantPlatformAdminAccessToBusiness(user.id, localDevelopmentBusinessId);
    }
    return {
      ...profile,
      business_id: localDevelopmentBusinessId,
      role: normalizeDashboardRole(profile.role as LegacyRole),
      rawRole: profile.role as LegacyRole,
      user,
    };
  }

  const effectiveBusinessId = await syncPlatformAdminBusinessContext({
    userId: user.id,
    email: user.email,
    currentBusinessId: profile.business_id,
  });

  return {
    ...profile,
    business_id: effectiveBusinessId,
    role: normalizeDashboardRole(profile.role as LegacyRole),
    rawRole: profile.role as LegacyRole,
    user,
  };
});

export const getCurrentDashboardBusinessId = cache(async function getCurrentDashboardBusinessId() {
  const profile = await getCurrentDashboardProfile();
  return profile?.business_id ?? null;
});

export async function requireAdminDashboardPage() {
  const profile = await getCurrentDashboardProfile();
  if (!profile || profile.role !== 'admin') {
    redirect('/dashboard');
  }
  return profile;
}

export async function assertAdminDashboardAction() {
  const profile = await getCurrentDashboardProfile();
  if (!profile) {
    redirect('/login');
  }
  if (profile.role !== 'admin') throw new Error('Admin access required');
  return profile;
}

function getPlatformAdminEmails() {
  return (process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function getConfiguredPlatformAdminEmails() {
  return getPlatformAdminEmails();
}

function normalizeHost(value: string | null | undefined) {
  if (!value) return '';
  const first = value.split(',')[0]?.trim() ?? '';
  const withoutPath = first.split('/')[0] ?? first;
  return withoutPath
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/:\d+$/, '')
    .replace(/\/+$/, '');
}

function getPlatformAdminHosts() {
  const configured = (process.env.PLATFORM_ADMIN_HOSTS || '')
    .split(',')
    .map((host) => normalizeHost(host))
    .filter(Boolean);
  if (configured.length > 0) return configured;
  return ['hsgrowth.com', 'www.hsgrowth.com'];
}

export function isPlatformHost(host: string | null | undefined) {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  if (normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '[::1]') return true;
  return getPlatformAdminHosts().includes(normalized);
}

export async function isPlatformHostRequest() {
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') || requestHeaders.get('host');
  return isPlatformHost(host);
}

export function isPlatformAdminEmail(email: string | null | undefined) {
  const normalized = (email ?? '').trim().toLowerCase();
  if (!normalized) return false;
  const allowed = getPlatformAdminEmails();
  if (allowed.length === 0) return process.env.NODE_ENV !== 'production';
  return allowed.includes(normalized);
}

export async function requirePlatformAdminDashboardPage() {
  const profile = await getCurrentDashboardProfile();
  if (
    !profile ||
    profile.role !== 'admin' ||
    !isPlatformAdminEmail(profile.user.email) ||
    !(await isPlatformHostRequest())
  ) {
    redirect('/dashboard');
  }
  return profile;
}

export async function assertPlatformAdminAction() {
  const profile = await getCurrentDashboardProfile();
  if (!profile) throw new Error('Authentication required');
  if (profile.role !== 'admin') throw new Error('Admin access required');
  if (!isPlatformAdminEmail(profile.user.email)) throw new Error('Platform admin access required');
  if (!(await isPlatformHostRequest())) throw new Error('Platform domain access required');
  return profile;
}
