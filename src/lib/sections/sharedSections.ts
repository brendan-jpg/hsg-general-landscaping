import { cache } from 'react';
import { getCurrentDashboardBusinessId } from '@/lib/authz/dashboard';
import { sectionRegistry, type TemplatePageContent } from '@/lib/sections/templatePages';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { Json, TablesUpdate } from '@/lib/types/database';

export interface SharedSectionComponent {
  id: string;
  name: string;
  sectionType: string;
  data: Record<string, unknown>;
  updatedAt: string;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function sanitizeSharedSectionRecord(input: unknown): SharedSectionComponent | null {
  const record = asObject(input);
  const id = asString(record.id);
  const name = asString(record.name);
  const sectionType = asString(record.sectionType);
  const sectionDef = sectionRegistry[sectionType];
  if (!id || !name || !sectionType || !sectionDef) return null;

  return {
    id,
    name,
    sectionType,
    data: sectionDef.sanitizeData(record.data) as Record<string, unknown>,
    updatedAt: asString(record.updatedAt) || new Date(0).toISOString(),
  };
}

export function parseSharedSections(input: unknown): SharedSectionComponent[] {
  return asArray(input)
    .map((item) => sanitizeSharedSectionRecord(item))
    .filter((item): item is SharedSectionComponent => Boolean(item));
}

export function getSharedSectionsFromSettings(settings: unknown): SharedSectionComponent[] {
  const record = asObject(settings);
  return parseSharedSections(record.shared_sections);
}

export function serializeSharedSections(sharedSections: SharedSectionComponent[]): Json {
  return sharedSections.map((section) => ({
    id: section.id,
    name: section.name,
    sectionType: section.sectionType,
    data: section.data as Json,
    updatedAt: section.updatedAt,
  })) as Json;
}

export function withSharedSectionsInSettings(
  settings: unknown,
  sharedSections: SharedSectionComponent[],
): Record<string, unknown> {
  const record = asObject(settings);
  return {
    ...record,
    shared_sections: serializeSharedSections(sharedSections),
  };
}

export function resolveSharedSectionsInContent(
  content: TemplatePageContent,
  sharedSections: SharedSectionComponent[],
): TemplatePageContent {
  if (sharedSections.length === 0) return content;

  const sharedSectionById = new Map(sharedSections.map((section) => [section.id, section] as const));

  return {
    ...content,
    sections: content.sections.map((section) => {
      const sharedSectionId = typeof section.sharedSectionId === 'string' ? section.sharedSectionId.trim() : '';
      if (!sharedSectionId) return section;

      const sharedSection = sharedSectionById.get(sharedSectionId);
      if (!sharedSection) return section;

      return {
        ...section,
        type: sharedSection.sectionType,
        data: structuredClone(sharedSection.data),
        sharedSectionName: sharedSection.name,
      };
    }),
  };
}

export const getDashboardSharedSections = cache(async (): Promise<SharedSectionComponent[]> => {
  const businessId = await getCurrentDashboardBusinessId();
  if (!businessId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('businesses')
    .select('settings')
    .eq('id', businessId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return getSharedSectionsFromSettings(data?.settings);
});

export async function saveBusinessSharedSections(businessId: string, sharedSections: SharedSectionComponent[]) {
  const supabase = createAdminClient();
  const { data: businessRow, error: fetchError } = await supabase
    .from('businesses')
    .select('settings')
    .eq('id', businessId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!businessRow) throw new Error('Business not found');

  const nextSettings = withSharedSectionsInSettings(businessRow.settings, parseSharedSections(sharedSections));
  const { error: updateError } = await supabase
    .from('businesses')
    .update({ settings: nextSettings as Json } satisfies TablesUpdate<'businesses'>)
    .eq('id', businessId);

  if (updateError) throw new Error(updateError.message);
}
