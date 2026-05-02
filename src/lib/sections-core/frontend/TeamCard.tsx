import AppImage from '../components/shared/AppImage';

interface TeamCardProps {
  member: {
    id: string;
    first_name?: string | null;
    last_name?: string | null;
    title?: string | null;
    bio?: string | null;
    photo_url?: string | null;
  };
  showBio?: boolean;
}

export default function TeamCard({ member, showBio = true }: TeamCardProps) {
  const displayName =
    [member.first_name, member.last_name].filter(Boolean).join(' ').trim() || 'Unnamed Team Member';

  return (
    <article className="team-card">
      {member.photo_url && (
        <div className="team-card__image">
          <AppImage role="avatar" src={member.photo_url} alt={displayName} width={800} height={800} />
        </div>
      )}
      <div className="team-card__body">
        <h2 className="team-card__name">{displayName}</h2>
        {member.title && <p className="team-card__title">{member.title}</p>}
        {showBio && member.bio && <p className="team-card__bio">{member.bio}</p>}
      </div>
    </article>
  );
}


