import AppImage from './AppImage';
import ServiceIcon, { isServiceIconKey } from './ServiceIcon';

export function isIconImageValue(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0 && !isServiceIconKey(value);
}

interface IconValueProps {
  value: string | null | undefined;
  className?: string;
  imageClassName?: string;
}

export default function IconValue({ value, className, imageClassName }: IconValueProps) {
  if (isServiceIconKey(value)) {
    return <ServiceIcon name={value} className={className} />;
  }

  if (isIconImageValue(value)) {
    return <AppImage role="logo" src={value} alt="" aria-hidden="true" className={imageClassName} width={64} height={64} />;
  }

  return null;
}
