import Link from 'next/link';
import type { Tables } from '../lib/types/database';
import PageSection from './PageSection';
import AreaCard from './AreaCard';

type Area = Tables<'service_areas'>;

interface AreaGridSectionProps {
  areas: Area[];
  heading?: string;
  accent?: string;
  lede?: string;
  className?: string;
  gridClassName?: string;
  variant?: 'default' | 'condensed';
  viewAllHref?: string;
  headingAs?: 'h1' | 'h2';
}

export default function AreaGridSection({
  areas,
  heading,
  accent,
  lede,
  className,
  gridClassName,
  variant = 'default',
  viewAllHref,
  headingAs = 'h2',
}: AreaGridSectionProps) {
  if (areas.length === 0) return null;
  const action = variant === 'condensed' && viewAllHref ? <Link href={viewAllHref} className="btn btn--secondary">View All</Link> : null;

  return (
    <PageSection
      heading={heading}
      accent={accent}
      lede={lede}
      headingAs={headingAs}
      className={[className, variant === 'condensed' ? 'areas-section--condensed' : ''].filter(Boolean).join(' ')}
    >
      <div className={['areas__grid', 'auto-grid', gridClassName].filter(Boolean).join(' ')}>
        {areas.map((area) => (
          <AreaCard key={area.id} area={area} />
        ))}
      </div>
      {action ? <div className="content-section__action content-section__action--below">{action}</div> : null}
    </PageSection>
  );
}
