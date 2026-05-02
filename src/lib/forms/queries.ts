import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getDashboardBusinessId } from '@/lib/dashboard/queries';
import { getBusiness } from '@/lib/utils/business';
import type { Json, Tables } from '@/lib/types/database';

type FormDefinition = Tables<'forms'>;
type EmailTemplate = Tables<'email_templates'>;
export type DashboardFormDefinition = FormDefinition & { is_used: boolean };

function collectReferencedFormIds(value: Json | null | undefined, formIds: Set<string>, matches: Set<string>) {
  if (value === null || value === undefined) return;
  if (typeof value === 'string') {
    if (formIds.has(value)) matches.add(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectReferencedFormIds(item as Json, formIds, matches));
    return;
  }
  if (typeof value === 'object') {
    Object.values(value as Record<string, Json>).forEach((item) => collectReferencedFormIds(item, formIds, matches));
  }
}

export async function getDashboardForms() {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [] as DashboardFormDefinition[];

  const supabase = await createClient();
  const [{ data, error }, { data: pages, error: pagesError }, { data: business, error: businessError }] =
    await Promise.all([
      supabase.from('forms').select('*').eq('business_id', businessId).order('name', { ascending: true }),
      supabase.from('pages').select('content').eq('business_id', businessId),
      supabase.from('businesses').select('settings').eq('id', businessId).maybeSingle(),
    ]);

  if (error) throw new Error(error.message);
  if (pagesError) throw new Error(pagesError.message);
  if (businessError) throw new Error(businessError.message);

  const forms = (data ?? []) as FormDefinition[];
  const formIds = new Set(forms.map((form) => form.id));
  const usedFormIds = new Set<string>();
  const configuredContactFormId = business?.settings && typeof business.settings === 'object'
    ? (business.settings as Record<string, Json>).contact_form_id
    : null;
  if (typeof configuredContactFormId === 'string' && formIds.has(configuredContactFormId)) {
    usedFormIds.add(configuredContactFormId);
  }
  (pages ?? []).forEach((page) => collectReferencedFormIds(page.content as Json, formIds, usedFormIds));

  return forms.map((form) => ({ ...form, is_used: usedFormIds.has(form.id) }));
}


export async function getDashboardFormById(id: string) {
  const normalizedId = id.trim();
  if (!normalizedId) return null as DashboardFormDefinition | null;
  const forms = await getDashboardForms();
  return forms.find((form) => form.id === normalizedId) ?? null;
}

export async function getDashboardEmailTemplatesForSelection() {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [] as Array<Pick<EmailTemplate, 'id' | 'name' | 'is_active'>>;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('email_templates')
    .select('id, name, is_active')
    .eq('business_id', businessId)
    .order('name', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Array<Pick<EmailTemplate, 'id' | 'name' | 'is_active'>>;
}

export async function getActiveFormById(id: string) {
  const normalizedId = id.trim();
  if (!normalizedId) return null as FormDefinition | null;

  const business = await getBusiness();
  if (!business) return null as FormDefinition | null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('forms')
    .select('*')
    .eq('business_id', business.id)
    .eq('id', normalizedId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data ?? null) as FormDefinition | null;
}
