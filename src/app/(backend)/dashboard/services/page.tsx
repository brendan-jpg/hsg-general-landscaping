import Button from '@/components/shared/Button';
import ServicesAdminList from '@/components/backend/ServicesAdminList';
import ModuleShell from '@/components/backend/shell/ModuleShell';
import { getDashboardServices } from '@/lib/services/queries';

export default async function ServicesManagePage() {
  const services = await getDashboardServices();

  return (
    <ModuleShell
      title="Services"
      description="Manage your service offerings"
      footer={
        <>
          <div id="services-list-bulk-controls" />
        </>
      }
    >
      <ServicesAdminList
        services={services}
        bulkPortalTargetId="services-list-bulk-controls"
        headerAction={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button as="link" href="/dashboard/services/new" variant="btn--primary" size="btn--sm">
              New Service
            </Button>
          </div>
        }
      />
    </ModuleShell>
  );
}
