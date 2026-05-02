import { notFound } from 'next/navigation';
import ModuleShell from '@/components/backend/shell/ModuleShell';
import EstimateEditorForm from '@/components/backend/EstimateEditorForm';
import { getDashboardBusinessSettings } from '@/lib/dashboard/queries';
import { listQuickBooksItemsForBusiness } from '@/lib/integrations/quickbooks';
import { getDashboardContactsForSelection, getDashboardEstimateById } from '@/lib/operations/queries';
import { getCurrentDashboardBusinessId } from '@/lib/authz/dashboard';

interface Props {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ contactId?: string }>;
}

export default async function EstimateEditorPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const isNew = id === 'new';
  const estimate = isNew ? null : await getDashboardEstimateById(id);
  if (!isNew && !estimate) notFound();
  const businessId = await getCurrentDashboardBusinessId();
  const [contacts, quickBooksItems, businessSettings] = await Promise.all([
    getDashboardContactsForSelection(),
    businessId ? listQuickBooksItemsForBusiness(businessId).catch(() => []) : Promise.resolve([]),
    getDashboardBusinessSettings(),
  ]);
  const configuredDefaultTaxRate =
    typeof businessSettings?.default_tax_rate === 'number'
      ? businessSettings.default_tax_rate
      : typeof businessSettings?.default_tax_rate === 'string'
        ? Number(businessSettings.default_tax_rate)
        : null;
  const defaultTaxRate = Number.isFinite(configuredDefaultTaxRate) ? configuredDefaultTaxRate : null;

  return (
    <ModuleShell title={isNew ? 'New Estimate' : 'Edit Estimate'}>
      <EstimateEditorForm
        estimate={estimate}
        contacts={contacts}
        initialContactId={query.contactId}
        quickBooksItems={quickBooksItems}
        defaultTaxRate={defaultTaxRate}
      />
    </ModuleShell>
  );
}
