import type { ReactNode } from 'react';
import type { Tables } from '../lib/types/database';
import PrimaryButton from '../components/ui/PrimaryButton';
import AppImage from '../components/shared/AppImage';
import PageSection from './PageSection';

type TeamMember = Tables<'team_members'>;

interface OwnerSpotlightSectionProps {
  member: TeamMember | null;
  heading?: string;
  lede?: ReactNode;
  accent?: string;
  fallbackBio?: string;
  primaryCtaText?: string;
  primaryCtaHref?: string;
  className?: string;
  headingAs?: 'h1' | 'h2';
}

export default function OwnerSpotlightSection({
  member,
  heading = '',
  lede,
  accent,
  fallbackBio,
  primaryCtaText = 'Get a Quote',
  primaryCtaHref = '/contact',
  className,
  headingAs = 'h2',
}: OwnerSpotlightSectionProps) {
  if (!member) return null;

  const displayName = [member.first_name, member.last_name].filter(Boolean).join(' ').trim();
  const bio = member.bio?.trim() || fallbackBio?.trim() || '';
  const displayRole = member.title?.trim() || '';
  const photoUrl = member.photo_url?.trim() || '';

  return (
    <PageSection heading={heading} lede={lede} className={className} headingAs={headingAs}>
      <div className="profile-card-section">
        <div className="profile-card-section__copy">
          {accent?.trim() ? <p className="profile-card-section__accent">{accent.trim()}</p> : null}
          {displayName ? <h3>{displayName}</h3> : null}
          {displayRole ? <p className="profile-card-section__role">{displayRole}</p> : null}
          {bio ? <p className="profile-card-section__text">{bio}</p> : null}
          <PrimaryButton href={primaryCtaHref || '/contact'}>{primaryCtaText || 'Get a Quote'}</PrimaryButton>
        </div>
        <div className="profile-card-section__card">
          {photoUrl ? (
            <div className="profile-card-section__image">
              <AppImage role="avatar" src={photoUrl} alt={displayName} width={800} height={800} />
            </div>
          ) : null}
        </div>
      </div>
    </PageSection>
  );
}
