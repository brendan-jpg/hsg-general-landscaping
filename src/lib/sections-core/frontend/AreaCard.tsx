import Link from 'next/link';
import AppImage from '../components/shared/AppImage';
import IconValue from '../components/shared/IconValue';
import { getSectionsRuntime } from '../lib/runtime';

interface AreaCardProps {
  area: {
    id: string;
    name: string;
    slug: string;
    excerpt?: string | null;
    icon?: string | null;
    featured_image_url?: string | null;
  };
}

export default async function AreaCard({ area }: AreaCardProps) {
  const runtime = getSectionsRuntime();
  const business = await runtime.business.getBusiness();
  const stateCode = runtime.transforms.toStateCode(business?.state);
  const title = stateCode ? `${area.name}, ${stateCode}` : area.name;
  const excerpt = typeof area.excerpt === 'string' ? area.excerpt.trim() : '';
  const cardImageSizes = '(max-width: 767px) 100vw, (max-width: 1100px) 50vw, 420px';
  return (
    <Link href={`/service-areas/${area.slug}`} className="area-card">
      {area.featured_image_url && (
        <div className="area-card__image">
          <AppImage role="card" src={area.featured_image_url} alt={title} width={1200} height={375} sizes={cardImageSizes} />
        </div>
      )}
      <div className="area-card__body">
        <div className="area-card__title-row">
          {area.icon ? (
            <span className="area-card__icon" aria-hidden="true">
              <IconValue
                value={area.icon}
                className="area-card__icon-svg"
                imageClassName="area-card__icon-image"
              />
            </span>
          ) : null}
          <h3 className="area-card__title">{title}</h3>
        </div>
        {excerpt ? <p className="area-card__excerpt">{excerpt}</p> : null}
      </div>
    </Link>
  );
}
