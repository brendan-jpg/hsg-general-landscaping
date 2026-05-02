import ContactEditorPage from '@/components/backend/ContactEditorPage';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function LeadEditorPage({ params }: Props) {
  const { id } = await params;
  return <ContactEditorPage id={id} status="lead" singularLabel="Lead" />;
}
