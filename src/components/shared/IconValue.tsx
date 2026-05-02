import EntityIcon, { isEntityIconKey } from '@/components/shared/EntityIcon';
import AppImage from '@/components/shared/AppImage';

export function isIconImageValue(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0 && !isEntityIconKey(value);
}

interface IconValueProps {
  value: string | null | undefined;
  className?: string;
  imageClassName?: string;
}

export default function IconValue({ value, className, imageClassName }: IconValueProps) {
  if (isEntityIconKey(value)) {
    return <EntityIcon name={value} className={className} />;
  }

  if (isIconImageValue(value)) {
    return (
      <AppImage
        role="logo"
        src={value}
        alt=""
        aria-hidden="true"
        className={imageClassName}
        width={64}
        height={64}
      />
    );
  }

  return null;
}
