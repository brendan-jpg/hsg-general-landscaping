import { notFound } from 'next/navigation';
import ModuleShell from '@/components/backend/shell/ModuleShell';
import BlogEditorForm from '@/components/backend/BlogEditorForm';
import {
  getDashboardBlogPostById,
  getDashboardLinkedBlogPostServiceIds,
  getDashboardServicesForSelection,
} from '@/lib/content/queries';
import { getDashboardSharedSections } from '@/lib/sections/sharedSections';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function BlogEditorPage({ params }: Props) {
  const { id } = await params;
  const isNew = id === 'new';
  const [post, serviceOptions, linkedServiceIds, sharedSections] = await Promise.all([
    isNew ? Promise.resolve(null) : getDashboardBlogPostById(id),
    getDashboardServicesForSelection(),
    isNew ? Promise.resolve([]) : getDashboardLinkedBlogPostServiceIds(id),
    getDashboardSharedSections(),
  ]);
  if (!isNew && !post) notFound();

  return (
    <ModuleShell title={isNew ? 'New Post' : 'Edit Post'}>
      <BlogEditorForm
        post={post}
        serviceOptions={serviceOptions}
        linkedServiceIds={linkedServiceIds}
        sharedSections={sharedSections}
      />
    </ModuleShell>
  );
}
