import ModuleShell from '@/components/backend/shell/ModuleShell';
import TeamAdminList from '@/components/backend/TeamAdminList';
import Button from '@/components/shared/Button';
import { getDashboardTeamMembers } from '@/lib/content/queries';

export default async function TeamManagePage() {
  const members = await getDashboardTeamMembers();

  return (
    <ModuleShell
      title="Team"
      description="Manage your team members"
      footer={<div id="team-list-bulk-controls" />}
    >
      <TeamAdminList
        members={members}
        bulkPortalTargetId="team-list-bulk-controls"
        headerAction={
          <Button as="link" href="/dashboard/team/new">
            New Member
          </Button>
        }
      />
    </ModuleShell>
  );
}
