import type { Tables } from '@/lib/types/database';

type ContactStatus = Tables<'contacts'>['status'];

export function getContactListPath(status: ContactStatus) {
  if (status === 'lead') return '/dashboard/leads';
  if (status === 'prospect') return '/dashboard/prospects';
  if (status === 'customer') return '/dashboard/customers';
  return '/dashboard/customers';
}

export function getContactDetailPath(status: ContactStatus, id: string) {
  return `${getContactListPath(status)}/${id}`;
}
