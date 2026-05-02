import Link from 'next/link';
import Button from '@/components/shared/Button';
import ModuleShell from '@/components/backend/shell/ModuleShell';
import DataTable from '../../../../components/backend/DataTable';
import TemplateListSelect from '@/components/backend/TemplateListSelect';
import { deleteAreasBulk, updateAreaTemplateKeyAction } from '@/lib/actions';
import { getDashboardAreas } from '@/lib/content/queries';
import { toTemplatePageContent } from '@/lib/sections/templatePages';
import { AREA_TEMPLATE_OPTIONS } from '@/lib/sections/templateOptions';

export default async function AreasManagePage() {
  const areas = await getDashboardAreas();

  return (
    <ModuleShell
      title="Areas"
      description="Manage geographic areas and their area page content"
      footer={
        <>
          <div id="areas-list-bulk-controls" />
        </>
      }
    >
      <DataTable
        headerAction={
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button as="link" href="/dashboard/areas/new" variant="btn--primary" size="btn--sm">
              New Area
            </Button>
          </div>
        }
        columns={['Name', 'Slug', 'Template']}
        rows={areas.map((area) => ({
          Name: <Link href={`/dashboard/areas/${area.id}`}>{area.name}</Link>,
          Slug: area.slug,
          Template: (
            <TemplateListSelect
              ariaLabel={`Template for ${area.name}`}
              initialValue={toTemplatePageContent(area.content)?.templateKey ?? AREA_TEMPLATE_OPTIONS[0]?.key ?? 'area-content-v1'}
              options={AREA_TEMPLATE_OPTIONS}
              onChangeAction={updateAreaTemplateKeyAction.bind(null, area.id)}
            />
          ),
        }))}
        rowHrefs={areas.map((area) => `/dashboard/areas/${area.id}`)}
        bulkDelete={{
          rowIds: areas.map((area) => area.id),
          onDeleteSelected: deleteAreasBulk,
          itemLabel: 'Areas',
        }}
        bulkDeletePortalTargetId="areas-list-bulk-controls"
        bulkDeleteSelectLabel={`${areas.length} Total`}
        emptyMessage="No Areas yet"
      />
    </ModuleShell>
  );
}
