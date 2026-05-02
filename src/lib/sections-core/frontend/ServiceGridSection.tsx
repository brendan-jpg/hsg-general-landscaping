import Link from 'next/link';
import type { Tables } from '../lib/types/database';
import PageSection from './PageSection';
import ServiceCard from './ServiceCard';

type Service = Tables<'services'>;
const CONDENSE_THRESHOLD = 8;

interface ServiceGridSectionProps {
  services: Service[];
  heading?: string;
  accent?: string;
  lede?: string;
  className?: string;
  gridClassName?: string;
  variant?: 'default' | 'condensed';
  viewAllHref?: string;
  headingAs?: 'h1' | 'h2';
}

export default function ServiceGridSection({
  services,
  heading = 'Services',
  accent,
  lede,
  className,
  gridClassName,
  variant = 'default',
  viewAllHref,
  headingAs = 'h2',
}: ServiceGridSectionProps) {
  if (services.length === 0) return null;
  const topLevelServices = services.filter((service) => !service.parent_service_id);
  const familyRootIds = new Set(
    services.map((service) => service.parent_service_id ?? service.id),
  );
  const isSingleServiceFamily = familyRootIds.size <= 1;
  const shouldReduceForCondensed = variant === 'condensed' && services.length > CONDENSE_THRESHOLD;
  const visibleServices = shouldReduceForCondensed
    ? (
        isSingleServiceFamily
          ? services.slice(0, CONDENSE_THRESHOLD)
          : (topLevelServices.length > 0 ? topLevelServices : services.slice(0, CONDENSE_THRESHOLD))
      )
    : services;
  const action = variant === 'condensed' && viewAllHref ? <Link href={viewAllHref} className="btn btn--secondary">View All</Link> : null;

  return (
    <PageSection
      heading={heading}
      accent={accent}
      lede={lede}
      headingAs={headingAs}
      className={['services-list', className, variant === 'condensed' ? 'services-list--condensed' : ''].filter(Boolean).join(' ')}
    >
        <div className={['services-list__grid', 'auto-grid', gridClassName].filter(Boolean).join(' ')}>
          {visibleServices.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
        {action ? <div className="content-section__action content-section__action--below">{action}</div> : null}
    </PageSection>
  );
}
