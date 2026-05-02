import { notFound } from 'next/navigation';
import ModuleShell from '@/components/backend/shell/ModuleShell';
import JobEditorForm from '@/components/backend/JobEditorForm';
import {
  getDashboardContactsForSelection,
  getDashboardJobById,
  getDashboardJobTeamAssignments,
  getDashboardTeamMembersForJobAssignment,
} from '@/lib/operations/queries';

interface Props {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ contactId?: string }>;
}

export default async function JobEditorPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = searchParams ? await searchParams : {};
  const isNew = id === 'new';
  const [job, contacts, teamMembers, initialAssignments] = await Promise.all([
    isNew ? Promise.resolve(null) : getDashboardJobById(id),
    getDashboardContactsForSelection(),
    getDashboardTeamMembersForJobAssignment(),
    isNew ? Promise.resolve([]) : getDashboardJobTeamAssignments(id),
  ]);
  if (!isNew && !job) notFound();

  return (
    <ModuleShell title={isNew ? 'New Job' : 'Edit Job'}>
      <JobEditorForm
        job={job}
        contacts={contacts}
        teamMembers={teamMembers}
        initialAssignments={initialAssignments}
        initialContactId={query.contactId}
      />
    </ModuleShell>
  );
}
