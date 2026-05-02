import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentDashboardBusinessId } from '@/lib/authz/dashboard';
import { collectUploadedFormFiles } from '@/lib/forms/uploads';
import type { Tables } from '@/lib/types/database';

type Contact = Tables<'contacts'>;
type Job = Tables<'jobs'>;
type Estimate = Tables<'estimates'>;
type Invoice = Tables<'invoices'>;
type EmailLog = Tables<'email_log'>;
type FormSubmission = Tables<'form_submissions'>;
type ActivityLog = Tables<'activity_log'>;
type Media = Tables<'media'>;

export type DashboardContactFile = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number | null;
  createdAt: string | null;
  source: 'submission' | 'manual';
  sourceLabel: string;
};

async function createSignedStorageUrl(objectPath: string) {
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || 'media';
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(objectPath, 60 * 10);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

function getPrivateMediaObjectPath(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const record = metadata as Record<string, unknown>;
  const objectPath = typeof record.storage_object_path === 'string' ? record.storage_object_path.trim() : '';
  return objectPath || null;
}

async function getDashboardBusinessId() {
  return await getCurrentDashboardBusinessId();
}

function readSubmissionText(data: FormSubmission['data'], ...keys: string[]) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return '';
  const record = data as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value !== 'string') continue;
    const normalized = value.trim();
    if (normalized) return normalized;
  }
  return '';
}

function normalizeEmailValue(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function normalizePhoneValue(value: string | null | undefined) {
  return (value ?? '').replace(/\D+/g, '');
}

function normalizeLooseText(value: string | null | undefined) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function readSubmissionTextBySuffix(data: FormSubmission['data'], ...suffixes: string[]) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return '';
  const record = data as Record<string, unknown>;
  for (const suffix of suffixes) {
    for (const [key, value] of Object.entries(record)) {
      if (!key.endsWith(suffix)) continue;
      if (typeof value !== 'string') continue;
      const normalized = value.trim();
      if (normalized) return normalized;
    }
  }
  return '';
}

function submissionMatchesContact(contact: Contact, submission: Pick<FormSubmission, 'data'>) {
  const contactEmail = normalizeEmailValue(contact.email);
  const contactPhone = normalizePhoneValue(contact.phone);
  const submissionEmail = normalizeEmailValue(
    readSubmissionText(submission.data, 'email', 'email_address'),
  );
  const submissionPhone = normalizePhoneValue(
    readSubmissionText(submission.data, 'phone', 'phone_number', 'phoneNumber', 'mobile'),
  );
  const contactFirstName = normalizeLooseText(contact.first_name);
  const contactLastName = normalizeLooseText(contact.last_name);
  const contactFullName = normalizeLooseText([contact.first_name, contact.last_name].filter(Boolean).join(' '));
  const contactAddressLine1 = normalizeLooseText(contact.address_line1);
  const contactCity = normalizeLooseText(contact.city);
  const submissionFirstName = normalizeLooseText(
    readSubmissionText(submission.data, 'first_name', 'firstname', 'firstName', 'given_name'),
  );
  const submissionLastName = normalizeLooseText(
    readSubmissionText(submission.data, 'last_name', 'lastname', 'lastName', 'family_name', 'surname'),
  );
  const submissionFullName = normalizeLooseText(
    readSubmissionText(submission.data, 'name', 'full_name', 'fullName'),
  );
  const submissionAddressLine1 = normalizeLooseText(
    readSubmissionText(submission.data, 'address_line1', 'address', 'street_address', 'service_address', 'property_address') ||
      readSubmissionTextBySuffix(submission.data, '__address_line1'),
  );
  const submissionCity = normalizeLooseText(
    readSubmissionText(submission.data, 'city') || readSubmissionTextBySuffix(submission.data, '__city'),
  );

  if (contactEmail && submissionEmail && contactEmail === submissionEmail) return true;
  if (contactPhone && submissionPhone && contactPhone === submissionPhone) return true;
  const hasNameMatch =
    (contactFirstName && submissionFirstName && contactFirstName === submissionFirstName &&
      contactLastName && submissionLastName && contactLastName === submissionLastName) ||
    (contactFullName && submissionFullName && contactFullName === submissionFullName);
  if (hasNameMatch && contactAddressLine1 && submissionAddressLine1 && contactAddressLine1 === submissionAddressLine1) {
    return true;
  }
  if (hasNameMatch && contactCity && submissionCity && contactCity === submissionCity) return true;
  return false;
}

async function getMatchingOrphanedFormSubmissions(contact: Contact) {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [] as FormSubmission[];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('form_submissions')
    .select('*')
    .eq('business_id', businessId)
    .is('contact_id', null)
    .order('created_at', { ascending: false })
    .limit(250);

  if (error) throw new Error(error.message);
  const orphaned = (data ?? []) as FormSubmission[];
  const directMatches = orphaned.filter((submission) => submissionMatchesContact(contact, submission));
  if (directMatches.length > 0) return directMatches;

  if (contact.source !== 'website_form' || !contact.created_at) return [];

  const contactCreatedAt = new Date(contact.created_at).getTime();
  if (Number.isNaN(contactCreatedAt)) return [];

  const candidates = orphaned
    .map((submission) => ({
      submission,
      distance: submission.created_at ? Math.abs(new Date(submission.created_at).getTime() - contactCreatedAt) : Number.POSITIVE_INFINITY,
    }))
    .filter((candidate) => Number.isFinite(candidate.distance) && candidate.distance <= 10 * 60 * 1000)
    .sort((a, b) => a.distance - b.distance);

  if (candidates.length === 0) return [];
  if (candidates.length === 1) return [candidates[0]!.submission];
  if (candidates[0]!.distance < candidates[1]!.distance) return [candidates[0]!.submission];
  return [];
}

export async function getDashboardContacts(status?: Contact['status'] | 'all') {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [];

  const supabase = await createClient();
  let query = supabase
    .from('contacts')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Contact[];
}

export async function getDashboardContactById(id: string) {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .eq('business_id', businessId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as Contact | null;
}

export async function getDashboardContactJobs(contactId: string) {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('business_id', businessId)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(25);

  if (error) throw new Error(error.message);
  return (data ?? []) as Job[];
}

export async function getDashboardContactEstimates(contactId: string) {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('estimates')
    .select('*')
    .eq('business_id', businessId)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(25);

  if (error) throw new Error(error.message);
  return (data ?? []) as Estimate[];
}

export async function getDashboardContactInvoices(contactId: string) {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('business_id', businessId)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(25);

  if (error) throw new Error(error.message);
  return (data ?? []) as Invoice[];
}

export async function getDashboardContactEmailLog(contactId: string) {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('email_log')
    .select('*')
    .eq('business_id', businessId)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(25);

  if (error) throw new Error(error.message);
  return (data ?? []) as EmailLog[];
}

export async function getDashboardContactFormSubmissions(contactId: string) {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [];

  const contact = await getDashboardContactById(contactId);
  if (!contact) return [];

  const supabase = await createClient();
  const [{ data, error }, orphanedMatches] = await Promise.all([
    supabase
      .from('form_submissions')
      .select('*')
      .eq('business_id', businessId)
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(25),
    getMatchingOrphanedFormSubmissions(contact),
  ]);

  if (error) throw new Error(error.message);

  let sourceSubmission: FormSubmission | null = null;
  if (contact.source_submission_id) {
    const { data: sourceData, error: sourceError } = await supabase
      .from('form_submissions')
      .select('*')
      .eq('business_id', businessId)
      .eq('id', contact.source_submission_id)
      .maybeSingle();
    if (sourceError) throw new Error(sourceError.message);
    sourceSubmission = (sourceData as FormSubmission | null) ?? null;
  }

  const merged = new Map<string, FormSubmission>();
  for (const submission of (data ?? []) as FormSubmission[]) {
    merged.set(submission.id, submission);
  }
  if (sourceSubmission) {
    merged.set(sourceSubmission.id, sourceSubmission);
  }
  for (const submission of orphanedMatches) {
    merged.set(submission.id, submission);
  }

  return [...merged.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export async function getDashboardContactFiles(contactId: string) {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [] as DashboardContactFile[];

  const contact = await getDashboardContactById(contactId);
  if (!contact) return [] as DashboardContactFile[];

  const supabase = await createClient();
  const [submissionsResult, mediaResult, orphanedMatches] = await Promise.all([
    supabase
      .from('form_submissions')
      .select('id, created_at, form_type, data')
      .eq('business_id', businessId)
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(25),
    supabase
      .from('media')
      .select('id, created_at, file_name, file_url, file_type, file_size, metadata')
      .eq('business_id', businessId)
      .contains('metadata', { related_entity_type: 'contact', related_entity_id: contactId })
      .order('created_at', { ascending: false })
      .limit(50),
    getMatchingOrphanedFormSubmissions(contact),
  ]);

  if (submissionsResult.error) throw new Error(submissionsResult.error.message);
  if (mediaResult.error) throw new Error(mediaResult.error.message);

  let sourceSubmission: Pick<FormSubmission, 'id' | 'created_at' | 'form_type' | 'data'> | null = null;
  if (contact.source_submission_id) {
    const { data: sourceData, error: sourceError } = await supabase
      .from('form_submissions')
      .select('id, created_at, form_type, data')
      .eq('business_id', businessId)
      .eq('id', contact.source_submission_id)
      .maybeSingle();
    if (sourceError) throw new Error(sourceError.message);
    sourceSubmission =
      (sourceData as Pick<FormSubmission, 'id' | 'created_at' | 'form_type' | 'data'> | null) ?? null;
  }

  const linkedAndOrphanedSubmissions = [
    ...((submissionsResult.data ?? []) as Array<Pick<FormSubmission, 'id' | 'created_at' | 'form_type' | 'data'>>),
    ...(sourceSubmission ? [sourceSubmission] : []),
    ...orphanedMatches,
  ];

  const dedupedSubmissions = Array.from(
    new Map(linkedAndOrphanedSubmissions.map((submission) => [submission.id, submission])).values(),
  );

  const submissionFiles = await Promise.all(
    dedupedSubmissions.flatMap((submission) => {
      const uploadedFiles = collectUploadedFormFiles(submission.data);

      return uploadedFiles.map(async (file, index) => ({
        id: `${submission.id}-${index}-${file.storage_path || file.file_url || file.file_name}`,
        fileName: file.file_name,
        fileUrl: file.storage_path ? await createSignedStorageUrl(file.storage_path) : file.file_url,
        fileType: file.file_type,
        fileSize: file.file_size,
        createdAt: submission.created_at,
        source: 'submission' as const,
        sourceLabel: 'Client upload',
      }));
    }),
  );

  const manualFiles = await Promise.all(
    ((mediaResult.data ?? []) as Array<
      Pick<Media, 'id' | 'created_at' | 'file_name' | 'file_url' | 'file_type' | 'file_size' | 'metadata'>
    >).map(async (file) => ({
      id: file.id,
      fileName: file.file_name,
      fileUrl: getPrivateMediaObjectPath(file.metadata)
        ? await createSignedStorageUrl(getPrivateMediaObjectPath(file.metadata) as string)
        : file.file_url,
      fileType: file.file_type,
      fileSize: file.file_size,
      createdAt: file.created_at,
      source: 'manual' as const,
      sourceLabel: 'Added by team',
    })),
  );

  return [...manualFiles, ...submissionFiles].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });
}

export async function getDashboardContactActivityLog(contactId: string) {
  const businessId = await getDashboardBusinessId();
  if (!businessId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('activity_log')
    .select('*, profiles!activity_log_user_id_fkey(first_name, last_name)')
    .eq('business_id', businessId)
    .eq('entity_type', 'contact')
    .eq('entity_id', contactId)
    .in('action', ['contact_called', 'contact_texted', 'contact_emailed', 'contact_noted'])
    .limit(50);

  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<
    ActivityLog & {
      profiles?: { first_name?: string | null; last_name?: string | null } | null;
    }
  >).sort((a, b) => {
    const aPinned =
      a.metadata && typeof a.metadata === 'object' && !Array.isArray(a.metadata)
        ? (a.metadata as Record<string, unknown>).pinned === true
        : false;
    const bPinned =
      b.metadata && typeof b.metadata === 'object' && !Array.isArray(b.metadata)
        ? (b.metadata as Record<string, unknown>).pinned === true
        : false;

    if (aPinned !== bPinned) return aPinned ? -1 : 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}
