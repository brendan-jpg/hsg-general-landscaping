import { notFound } from 'next/navigation';
import ModuleShell from '@/components/backend/shell/ModuleShell';
import FaqEditorForm from '@/components/backend/FaqEditorForm';
import {
  getDashboardFaqById,
  getDashboardLinkedFaqServiceIds,
  getDashboardServicesForSelection,
} from '@/lib/content/queries';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function FaqEditorPage({ params }: Props) {
  const { id } = await params;
  const isNew = id === 'new';

  const faq = isNew ? null : await getDashboardFaqById(id);
  if (!isNew && !faq) notFound();

  const serviceOptions = await getDashboardServicesForSelection();
  const linkedServiceIds = isNew ? [] : await getDashboardLinkedFaqServiceIds(id);

  return (
    <ModuleShell title={isNew ? 'New FAQ' : 'Edit FAQ'}>
      <FaqEditorForm faq={faq} serviceOptions={serviceOptions} linkedServiceIds={linkedServiceIds} />
    </ModuleShell>
  );
}
