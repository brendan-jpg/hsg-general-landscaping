import { PageHero, TeamGridSection } from '@/lib/sections-core/frontend';
import { getTeamMembers } from '@/lib/content/queries';

export default async function TeamPage() {
  const teamMembers = await getTeamMembers();

  return (
    <div className="page page--team">
      <PageHero
        heading="Our Team"
        lede="Meet the people behind the work and the service experience."
        meta={`${teamMembers.length} team member${teamMembers.length === 1 ? '' : 's'}`}
        className="team__hero"
      />
      {teamMembers.length === 0 ? (
        <p>No team members yet.</p>
      ) : (
        <TeamGridSection members={teamMembers} heading="Team Grid" />
      )}
    </div>
  );
}

