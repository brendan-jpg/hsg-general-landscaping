import { createClient, createPublicClient } from '@/lib/supabase/server';
import { getCurrentDashboardBusinessId } from '@/lib/authz/dashboard';
import { getBusiness, getBusinessSettingString } from '@/lib/utils/business';
import type { Tables } from '@/lib/types/database';

type Service = Tables<'services'>;

function isTransientPublicQueryError(message: string) {
  const normalized = message.trim().toLowerCase();
  return (
    normalized === 'internal server error.' ||
    normalized === 'internal server error' ||
    normalized.includes('bad gateway') ||
    normalized.includes('error code 502') ||
    normalized.includes('cloudflare')
  );
}

function applyDefaultServiceIcon<T extends Service | null>(service: T, business: Awaited<ReturnType<typeof getBusiness>>) {
  if (!service) return service;
  if (service.icon?.trim()) return service;
  const fallbackIcon = getBusinessSettingString(business?.settings, 'service_default_icon');
  return fallbackIcon ? ({ ...service, icon: fallbackIcon } as T) : service;
}

async function getDashboardBusinessId() {
  return await getCurrentDashboardBusinessId();
}

export async function getDashboardServices() {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('business_id', businessId)
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Service[];
}

export async function getDashboardServiceById(id: string) {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as Service | null;
}

export async function getActiveServices() {
  const business = await getBusiness();
  if (!business) return [];

  const supabase = createPublicClient();
  const query = supabase
    .from('services')
    .select('*')
    .eq('business_id', business.id)
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true });

  const { data, error } = await query;
  if (error) {
    if (isTransientPublicQueryError(error.message)) {
      console.warn('Active services unavailable due to transient upstream error:', error.message);
      return [];
    }
    throw new Error(error.message);
  }
  return ((data ?? []) as Service[]).map((service) => applyDefaultServiceIcon(service, business));
}

export async function getServiceBySlug(slug: string) {
  const business = await getBusiness();
  if (!business) return null;

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('business_id', business.id)
    .eq('slug', slug)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);
  return applyDefaultServiceIcon(((data ?? [])[0] ?? null) as Service | null, business);
}

export async function getServiceById(id: string) {
  const business = await getBusiness();
  if (!business) return null;

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('business_id', business.id)
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return applyDefaultServiceIcon(data as Service | null, business);
}

export async function getActiveChildServices(parentServiceId: string) {
  const business = await getBusiness();
  if (!business) return [];

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('business_id', business.id)
    .eq('parent_service_id', parentServiceId)
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as Service[]).map((service) => applyDefaultServiceIcon(service, business));
}
