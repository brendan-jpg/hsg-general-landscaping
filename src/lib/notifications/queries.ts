import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentDashboardBusinessId } from '@/lib/authz/dashboard';
import type { Json, Tables } from '@/lib/types/database';
import { formatPhone } from '@/lib/utils';

type FormSubmission = Tables<'form_submissions'>;
type Contact = Tables<'contacts'>;

export interface DashboardLeadNotification {
  id: string;
  contactId: string | null;
  href: string;
  title: string;
  preview: string;
  sourceLabel: string;
  submittedAt: string;
}

export interface DashboardLeadNotificationsPayload {
  unreadLeadCount: number;
  notifications: DashboardLeadNotification[];
}

function readString(data: Json, ...keys: string[]) {
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

function formatSubmissionSource(formType: FormSubmission['form_type']) {
  return formType
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatContactName(contact: Pick<Contact, 'first_name' | 'last_name' | 'email' | 'phone'> | null, submission: FormSubmission) {
  const fullName = [contact?.first_name, contact?.last_name].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;

  const submittedName = readString(submission.data, 'name', 'full_name', 'fullName');
  if (submittedName) return submittedName;

  const firstName = readString(submission.data, 'first_name', 'firstname', 'firstName', 'given_name');
  const lastName = readString(submission.data, 'last_name', 'lastname', 'lastName', 'family_name', 'surname');
  const joinedName = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (joinedName) return joinedName;

  return contact?.email?.trim() || (contact?.phone?.trim() ? formatPhone(contact.phone.trim()) : '') || 'New lead';
}

function formatPreview(submission: FormSubmission) {
  const message = readString(submission.data, 'message', 'details', 'notes', 'comment');
  if (message) return message.length > 120 ? `${message.slice(0, 117)}...` : message;

  const email = readString(submission.data, 'email', 'email_address');
  const phone = readString(submission.data, 'phone', 'phone_number', 'phoneNumber', 'mobile');
  const address = readString(submission.data, 'address', 'street_address', 'service_address', 'property_address');
  const fallback = [email, phone ? formatPhone(phone) : '', address].filter(Boolean)[0];
  if (fallback) return fallback;

  return submission.page_url?.trim() || 'Website form submission';
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

function readStringBySuffix(data: Json, ...suffixes: string[]) {
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

function submissionMatchesContact(
  submission: Pick<FormSubmission, 'data'>,
  contact: Pick<Contact, 'email' | 'phone' | 'first_name' | 'last_name' | 'address_line1' | 'city'>,
) {
  const submissionEmail = normalizeEmailValue(readString(submission.data, 'email', 'email_address'));
  const submissionPhone = normalizePhoneValue(
    readString(submission.data, 'phone', 'phone_number', 'phoneNumber', 'mobile'),
  );
  const contactEmail = normalizeEmailValue(contact.email);
  const contactPhone = normalizePhoneValue(contact.phone);
  const contactFirstName = normalizeLooseText(contact.first_name);
  const contactLastName = normalizeLooseText(contact.last_name);
  const contactFullName = normalizeLooseText([contact.first_name, contact.last_name].filter(Boolean).join(' '));
  const contactAddressLine1 = normalizeLooseText(contact.address_line1);
  const contactCity = normalizeLooseText(contact.city);
  const submissionFirstName = normalizeLooseText(
    readString(submission.data, 'first_name', 'firstname', 'firstName', 'given_name'),
  );
  const submissionLastName = normalizeLooseText(
    readString(submission.data, 'last_name', 'lastname', 'lastName', 'family_name', 'surname'),
  );
  const submissionFullName = normalizeLooseText(
    readString(submission.data, 'name', 'full_name', 'fullName'),
  );
  const submissionAddressLine1 = normalizeLooseText(
    readString(submission.data, 'address_line1', 'address', 'street_address', 'service_address', 'property_address') ||
      readStringBySuffix(submission.data, '__address_line1'),
  );
  const submissionCity = normalizeLooseText(
    readString(submission.data, 'city') || readStringBySuffix(submission.data, '__city'),
  );

  if (submissionEmail && contactEmail && submissionEmail === contactEmail) return true;
  if (submissionPhone && contactPhone && submissionPhone === contactPhone) return true;
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

export async function getDashboardLeadNotifications(limit = 6): Promise<DashboardLeadNotificationsPayload> {
  const businessId = await getCurrentDashboardBusinessId();
  if (!businessId) {
    return { unreadLeadCount: 0, notifications: [] };
  }

  const supabase = await createClient();
  const [{ data: statsRow, error: statsError }, { data: submissions, error: submissionsError }] = await Promise.all([
    supabase
      .from('dashboard_stats')
      .select('unread_submissions')
      .eq('business_id', businessId)
      .maybeSingle(),
    supabase
      .from('form_submissions')
      .select('id, contact_id, created_at, data, form_type, page_url, status')
      .eq('business_id', businessId)
      .eq('status', 'new')
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  if (statsError) throw new Error(statsError.message);
  if (submissionsError) throw new Error(submissionsError.message);

  const rows = (submissions ?? []) as Array<
    Pick<FormSubmission, 'id' | 'contact_id' | 'created_at' | 'data' | 'form_type' | 'page_url' | 'status'>
  >;
  const directContactIds = Array.from(new Set(rows.map((row) => row.contact_id).filter(Boolean))) as string[];

  const contactsById = new Map<
    string,
    Pick<Contact, 'id' | 'first_name' | 'last_name' | 'email' | 'phone' | 'address_line1' | 'city'>
  >();
  const orphanRows = rows.filter((row) => !row.contact_id);

  if (directContactIds.length > 0 || orphanRows.length > 0) {
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, email, phone, address_line1, city')
      .eq('business_id', businessId)
      .limit(orphanRows.length > 0 ? 500 : directContactIds.length || 1);
    if (contactsError) throw new Error(contactsError.message);

    for (const contact of contacts ?? []) {
      if (directContactIds.length === 0 || directContactIds.includes(contact.id) || orphanRows.length > 0) {
        contactsById.set(contact.id, contact);
      }
    }
  }

  return {
    unreadLeadCount: statsRow?.unread_submissions ?? rows.length,
    notifications: rows.map((submission) => {
      const directContact = submission.contact_id ? contactsById.get(submission.contact_id) ?? null : null;
      const matchedContact =
        directContact ??
        [...contactsById.values()].find((contact) => submissionMatchesContact(submission as FormSubmission, contact)) ??
        null;
      return {
        id: submission.id,
        contactId: matchedContact?.id ?? submission.contact_id,
        href: matchedContact?.id ? `/dashboard/leads/${matchedContact.id}` : '/dashboard/leads',
        title: formatContactName(matchedContact ?? null, submission as FormSubmission),
        preview: formatPreview(submission as FormSubmission),
        sourceLabel: formatSubmissionSource(submission.form_type),
        submittedAt: submission.created_at,
      };
    }),
  };
}

export async function markLeadNotificationsReadForContact(contactId: string) {
  const businessId = await getCurrentDashboardBusinessId();
  if (!businessId) return;

  const admin = createAdminClient();
  const { data: contact, error: contactError } = await admin
    .from('contacts')
    .select('id, email, phone, first_name, last_name, address_line1, city')
    .eq('business_id', businessId)
    .eq('id', contactId)
    .maybeSingle();
  if (contactError) throw new Error(contactError.message);

  const { error } = await admin
    .from('form_submissions')
    .update({ status: 'read' })
    .eq('business_id', businessId)
    .eq('contact_id', contactId)
    .eq('status', 'new');

  if (error) throw new Error(error.message);

  if (!contact) return;

  const { data: orphanRows, error: orphanError } = await admin
    .from('form_submissions')
    .select('id, data')
    .eq('business_id', businessId)
    .is('contact_id', null)
    .eq('status', 'new')
    .limit(250);
  if (orphanError) throw new Error(orphanError.message);

  const orphanIds = ((orphanRows ?? []) as Array<Pick<FormSubmission, 'id' | 'data'>>)
    .filter((submission) => submissionMatchesContact(submission as FormSubmission, contact))
    .map((submission) => submission.id);

  if (orphanIds.length === 0) return;

  const { error: markOrphanError } = await admin
    .from('form_submissions')
    .update({ status: 'read' })
    .eq('business_id', businessId)
    .is('contact_id', null)
    .in('id', orphanIds)
    .eq('status', 'new');

  if (markOrphanError) throw new Error(markOrphanError.message);
}

export async function markAllLeadNotificationsReadForBusiness() {
  const businessId = await getCurrentDashboardBusinessId();
  if (!businessId) return;

  const admin = createAdminClient();
  const { error } = await admin
    .from('form_submissions')
    .update({ status: 'read' })
    .eq('business_id', businessId)
    .eq('status', 'new');

  if (error) throw new Error(error.message);
}
