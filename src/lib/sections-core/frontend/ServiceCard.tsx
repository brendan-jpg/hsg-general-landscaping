import Link from 'next/link';
import AppImage from '../components/shared/AppImage';
import IconValue from '../components/shared/IconValue';

interface ServiceCardProps {
  service: {
    id: string;
    title: string;
    slug: string;
    excerpt?: string | null;
    icon?: string | null;
    featured_image_url?: string | null;
  };
}

export default function ServiceCard({ service }: ServiceCardProps) {
  const imageUrl = typeof service.featured_image_url === 'string' ? service.featured_image_url : null;
  const hasImage = Boolean(imageUrl);
  const excerpt = typeof service.excerpt === 'string' ? service.excerpt.trim() : '';
  const cardImageSizes = '(max-width: 767px) 100vw, (max-width: 1100px) 50vw, 380px';

  return (
    <article className={`service-card${hasImage ? '' : ' service-card--no-image'}`}>
      {imageUrl && (
        <div className="service-card__image">
          <AppImage
            role="card"
            src={imageUrl}
            alt={service.title}
            width={1200}
            height={675}
            sizes={cardImageSizes}
          />
        </div>
      )}
      <div className="service-card__body">
        {service.icon && (
          <span className="service-card__icon">
            <IconValue value={service.icon} imageClassName="service-card__icon-image" />
          </span>
        )}
        <h3 className="service-card__title">{service.title}</h3>
        {excerpt ? <p className="service-card__excerpt">{excerpt}</p> : null}
        <Link href={`/services/${service.slug}`} className="service-card__action">
          <span>Learn more</span>
          <span className="service-card__action-arrow">→</span>
        </Link>
      </div>
    </article>
  );
}


