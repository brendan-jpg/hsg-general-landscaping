import Link from 'next/link';
import ModuleShell from '@/components/backend/shell/ModuleShell';
import DataTable from '@/components/backend/DataTable';
import Button from '@/components/shared/Button';
import { deleteFormsBulk } from '@/lib/actions';
import { getDashboardForms } from '@/lib/forms/queries';

export default async function FormsPage() {
  const forms = await getDashboardForms();

  return (
    <ModuleShell
      title="Forms"
      description="Build reusable form field schemas for frontend forms"
      footer={<div id="forms-list-bulk-controls" />}
    >
      <DataTable
        headerAction={
          <Button as="link" href="/dashboard/forms/new">
            New Form
          </Button>
        }
        columns={['Name', 'Slug', 'Status', 'Last Updated']}
        rows={forms.map((form) => ({
          Name: <Link href={`/dashboard/forms/${form.id}`}>{form.name}</Link>,
          Slug: form.slug,
          Status: form.is_used ? 'In Use' : 'Unused',
          'Last Updated': new Date(form.updated_at).toLocaleDateString(),
        }))}
        rowHrefs={forms.map((form) => `/dashboard/forms/${form.id}`)}
        bulkDelete={{
          rowIds: forms.map((form) => form.id),
          onDeleteSelected: deleteFormsBulk,
          itemLabel: 'forms',
        }}
        bulkDeletePortalTargetId="forms-list-bulk-controls"
        bulkDeleteSelectLabel={`${forms.length} Total`}
        emptyMessage="No forms yet"
      />
    </ModuleShell>
  );
}
