import { notFound } from 'next/navigation';
import ModuleShell from '@/components/backend/shell/ModuleShell';
import AreaEditorForm from '@/components/backend/AreaEditorForm';
import { getDashboardAreaById, getDashboardBusinessId } from '@/lib/content/queries';
import { getDashboardMedia, getDashboardMediaUsageByUrl } from '@/lib/media/queries';
import { getDashboardSharedSections } from '@/lib/sections/sharedSections';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AreaEditorPage({ params }: Props) {
  const { id } = await params;
  const isNew = id === 'new';

  const [area, businessId, mediaItems, mediaUsageByUrl, sharedSections] = await Promise.all([
    isNew ? Promise.resolve(null) : getDashboardAreaById(id),
    getDashboardBusinessId(),
    getDashboardMedia({ imagesOnly: true, limit: 25 }),
    getDashboardMediaUsageByUrl(),
    getDashboardSharedSections(),
  ]);
  if (!isNew && !area) notFound();

  return (
    <ModuleShell title={isNew ? 'New Area' : 'Edit Area'}>
      <AreaEditorForm
        area={area}
        businessId={area?.business_id ?? businessId ?? ''}
        mediaItems={mediaItems}
        mediaUsageByUrl={mediaUsageByUrl}
        sharedSections={sharedSections}
      />
    </ModuleShell>
  );
}
