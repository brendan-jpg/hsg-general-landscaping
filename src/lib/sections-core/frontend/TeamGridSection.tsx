import Link from 'next/link';
import type { Tables } from '../lib/types/database';
import PageSection from './PageSection';
import TeamCard from './TeamCard';

type TeamMember = Tables<'team_members'>;

interface TeamGridSectionProps {
  members: TeamMember[];
  heading?: string;
  accent?: string;
  lede?: string;
  className?: string;
  gridClassName?: string;
  variant?: 'default' | 'condensed';
  viewAllHref?: string;
  headingAs?: 'h1' | 'h2';
}

export default function TeamGridSection({
  members,
  heading = 'Team',
  accent,
  lede,
  className,
  gridClassName,
  variant = 'default',
  viewAllHref,
  headingAs = 'h2',
}: TeamGridSectionProps) {
  if (members.length === 0) return null;
  const action = variant === 'condensed' && viewAllHref ? <Link href={viewAllHref} className="btn btn--secondary">View All</Link> : null;
  return (
    <PageSection
      heading={heading}
      accent={accent}
      lede={lede}
      headingAs={headingAs}
      className={[className, variant === 'condensed' ? 'team-section--condensed' : ''].filter(Boolean).join(' ')}
    >
      <div className={['team__grid', 'auto-grid', gridClassName].filter(Boolean).join(' ')}>
        {members.map((member) => (
          <TeamCard key={member.id} member={member} />
        ))}
      </div>
      {action ? <div className="content-section__action content-section__action--below">{action}</div> : null}
    </PageSection>
  );
}

