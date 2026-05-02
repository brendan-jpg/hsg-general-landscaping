import ContactsListPage from '@/components/backend/ContactsListPage';

export default async function CustomersPage() {
  return (
    <ContactsListPage
      title="Customers"
      description="Manage customer records and history"
      status="customer"
      createLabel="New Customer"
    />
  );
}
