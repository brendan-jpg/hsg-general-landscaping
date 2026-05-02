import ContactEditorPage from '@/components/backend/ContactEditorPage';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProspectEditorPage({ params }: Props) {
  const { id } = await params;
  return <ContactEditorPage id={id} status="prospect" singularLabel="Prospect" />;
}
