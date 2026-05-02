import { redirect } from 'next/navigation';
import { getContactDetailPath, getContactListPath } from '@/lib/contacts/routing';
import { getDashboardContactById } from '@/lib/contacts/queries';

interface Props {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ status?: string }>;
}

export default async function ContactEditorRedirectPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = (searchParams ? await searchParams : {}) ?? {};
  const requestedStatus =
    query.status === 'customer' || query.status === 'prospect' || query.status === 'lead'
      ? query.status
      : 'lead';

  if (id === 'new') {
    redirect(getContactDetailPath(requestedStatus, 'new'));
  }

  const contact = await getDashboardContactById(id);
  if (!contact) {
    redirect(getContactListPath(requestedStatus));
  }

  redirect(getContactDetailPath(contact.status, contact.id));
}
