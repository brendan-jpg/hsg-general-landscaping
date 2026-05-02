import ContactsListPage from '@/components/backend/ContactsListPage';

export default async function ProspectsPage() {
  return (
    <ContactsListPage
      title="Prospects"
      description="Manage active prospects in your pipeline"
      status="prospect"
      createLabel="New Prospect"
    />
  );
}
