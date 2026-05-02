import type { ReactElement, SVGProps } from 'react';

type IconComponent = (props: SVGProps<SVGSVGElement>) => ReactElement;

export const SERVICE_ICON_OPTIONS = [
  { value: 'pin', label: 'Map Pin' },
  { value: 'roof', label: 'Roof' },
  { value: 'hammer', label: 'Hammer' },
  { value: 'wrench', label: 'Wrench' },
  { value: 'home', label: 'Home' },
  { value: 'shield', label: 'Shield' },
  { value: 'droplet', label: 'Droplet' },
  { value: 'paint', label: 'Paint Roller' },
  { value: 'spark', label: 'Spark' },
  { value: 'sun', label: 'Sun' },
  { value: 'bolt', label: 'Bolt' },
  { value: 'leaf', label: 'Leaf' },
  { value: 'check', label: 'Check' },
] as const;

export type ServiceIconKey = (typeof SERVICE_ICON_OPTIONS)[number]['value'];

const ICONS: Record<ServiceIconKey, IconComponent> = {
  pin: (props) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 21s-6-5.7-6-10a6 6 0 1 1 12 0c0 4.3-6 10-6 10z" />
      <circle cx="12" cy="11" r="2.5" />
    </svg>
  ),
  roof: (props) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M3 11.5 12 4l9 7.5" /><path d="M6 10v9h12v-9" /><path d="M10 19v-5h4v5" /></svg>,
  hammer: (props) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M14 4l6 6" /><path d="M12 6l6-2 2 2-2 6" /><path d="M3 21l9-9" /></svg>,
  wrench: (props) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 6.5a5 5 0 0 1-6.7 4.7l-8.8 8.8a2 2 0 1 1-2.8-2.8l8.8-8.8A5 5 0 0 1 17.5 3L14 6.5l3.5 3.5L21 6.5z" /></svg>,
  home: (props) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg>,
  shield: (props) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z" /></svg>,
  droplet: (props) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 3s6 6.2 6 10a6 6 0 1 1-12 0c0-3.8 6-10 6-10z" /></svg>,
  paint: (props) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="3" y="4" width="13" height="7" rx="1.5" /><path d="M16 7h3a2 2 0 0 1 2 2v2" /><path d="M10 11v4" /><path d="M8 15h4" /><path d="M9 15v6" /></svg>,
  spark: (props) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" /></svg>,
  sun: (props) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="M4.9 4.9l1.4 1.4" /><path d="M17.7 17.7l1.4 1.4" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="M4.9 19.1l1.4-1.4" /><path d="M17.7 6.3l1.4-1.4" /></svg>,
  bolt: (props) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" /></svg>,
  leaf: (props) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M5 21c9 0 14-6 14-16-10 0-16 5-16 14" /><path d="M5 21c0-5 4-9 9-9" /></svg>,
  check: (props) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg>,
};

export function isServiceIconKey(value: string | null | undefined): value is ServiceIconKey {
  return Boolean(value) && SERVICE_ICON_OPTIONS.some((option) => option.value === value);
}

interface ServiceIconProps {
  name: string | null | undefined;
  className?: string;
}

export default function ServiceIcon({ name, className }: ServiceIconProps) {
  if (!isServiceIconKey(name)) return null;
  const Icon = ICONS[name];
  return <Icon className={className} aria-hidden="true" width="1em" height="1em" />;
}
