import { notFound } from 'next/navigation';
import ModuleShell from '@/components/backend/shell/ModuleShell';
import PageEditorForm from '@/components/backend/PageEditorForm';
import { getDashboardPageById } from '@/lib/content/queries';
import { getDashboardForms } from '@/lib/forms/queries';
import { getDashboardSharedSections } from '@/lib/sections/sharedSections';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PageEditorPage({ params }: Props) {
  const { id } = await params;
  const isNew = id === 'new';

  const [page, forms, sharedSections] = await Promise.all([
    isNew ? Promise.resolve(null) : getDashboardPageById(id),
    getDashboardForms(),
    getDashboardSharedSections(),
  ]);
  if (!isNew && !page) notFound();

  return (
    <ModuleShell title={isNew ? 'New Page' : 'Edit Page'}>
      <PageEditorForm
        page={page}
        formOptions={forms.map((form) => ({ id: form.id, name: form.name, slug: form.slug }))}
        sharedSections={sharedSections}
      />
    </ModuleShell>
  );
}
