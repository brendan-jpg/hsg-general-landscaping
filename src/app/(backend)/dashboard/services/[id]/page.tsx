import { notFound } from 'next/navigation';
import ModuleShell from '@/components/backend/shell/ModuleShell';
import ServiceEditorForm from '@/components/backend/ServiceEditorForm';
import { getDashboardAreas } from '@/lib/content/queries';
import { getDashboardMedia, getDashboardMediaUsageByUrl } from '@/lib/media/queries';
import { getDashboardSharedSections } from '@/lib/sections/sharedSections';
import { getDashboardServiceById } from '@/lib/services/queries';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ServiceEditorPage({ params }: Props) {
  const { id } = await params;
  const isNew = id === 'new';

  const service = isNew ? null : await getDashboardServiceById(id);
  if (!isNew && !service) notFound();
  const [mediaItems, mediaUsageByUrl, AreaOptions, sharedSections] = await Promise.all([
    getDashboardMedia({ imagesOnly: true, limit: 25 }),
    getDashboardMediaUsageByUrl(),
    getDashboardAreas(),
    getDashboardSharedSections(),
  ]);

  return (
    <ModuleShell title={isNew ? 'New Service' : 'Edit Service'}>
      <ServiceEditorForm
        service={service}
        mediaItems={mediaItems}
        mediaUsageByUrl={mediaUsageByUrl}
        AreaOptions={AreaOptions.map((option) => ({ id: option.id, name: option.name }))}
        sharedSections={sharedSections}
      />
    </ModuleShell>
  );
}

