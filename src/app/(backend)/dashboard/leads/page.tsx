import ContactsListPage from '@/components/backend/ContactsListPage';
import { markAllLeadNotificationsReadForBusiness } from '@/lib/notifications/queries';

interface LeadsPageProps {
  searchParams?: Promise<{ stage?: string }>;
}

export default async function LeadsPage({ searchParams }: LeadsPageProps) {
  await markAllLeadNotificationsReadForBusiness();
  const params = searchParams ? await searchParams : {};

  return (
    <ContactsListPage
      title="Leads"
      description="Manage new inbound leads"
      status="lead"
      createLabel="New Lead"
      leadStage={params.stage}
    />
  );
}
