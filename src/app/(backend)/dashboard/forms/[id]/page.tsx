import { notFound } from 'next/navigation';
import ModuleShell from '@/components/backend/shell/ModuleShell';
import FormBuilderPlayground from '@/components/backend/FormBuilderPlayground';
import { getDashboardFormById } from '@/lib/forms/queries';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function FormEditorPage({ params }: Props) {
  const { id } = await params;
  const isNew = id === 'new';

  const form = isNew ? null : await getDashboardFormById(id);

  if (!isNew && !form) notFound();

  return (
    <ModuleShell title={isNew ? 'New Form' : 'Edit Form'}>
      <FormBuilderPlayground
        initialForms={form ? [form] : []}
        mode="edit"
        initialSelectedFormId={form?.id ?? null}
        showFormsSidebarList={false}
      />
    </ModuleShell>
  );
}
