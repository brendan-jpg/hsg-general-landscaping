import AppImage from '../components/shared/AppImage';

interface HeroImageProps {
  url?: string | null;
  alt: string;
  className: string;
}

export default function HeroImage({ url, alt, className }: HeroImageProps) {
  if (!url) return null;

  return (
    <div className={className}>
      <AppImage role="hero" src={url} alt={alt} width={1600} height={900} />
    </div>
  );
}

