import { notFound } from 'next/navigation';
import ModuleShell from '@/components/backend/shell/ModuleShell';
import EmailTemplateEditorForm from '@/components/backend/EmailTemplateEditorForm';
import { getCurrentDashboardBusinessId } from '@/lib/authz/dashboard';
import { createClient } from '@/lib/supabase/server';
import type { Tables } from '@/lib/types/database';

type EmailTemplate = Tables<'email_templates'>;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EmailTemplateEditorPage({ params }: Props) {
  const { id } = await params;
  const isNew = id === 'new';
  const supabase = await createClient();
  const businessId = await getCurrentDashboardBusinessId();
  if (!businessId) notFound();

  let template: EmailTemplate | null = null;
  if (!isNew) {
    const { data, error } = await supabase
      .from('email_templates')
      .select('*')
      .eq('id', id)
      .eq('business_id', businessId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    template = data as EmailTemplate | null;
    if (!template) notFound();
  }

  return (
    <ModuleShell title={isNew ? 'New Email Template' : 'Edit Email Template'}>
      <EmailTemplateEditorForm template={template} />
    </ModuleShell>
  );
}
