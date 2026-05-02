import { Hero as SectionsHero } from '@/lib/sections-core/frontend';
import { getActiveSystemPageHrefs } from '@/lib/content/queries';
import { getBusiness } from '@/lib/utils/business';

interface HeroProps {
  heading?: string;
  lede?: string;
  accent?: string;
  variant?: string;
  primaryCtaText?: string;
  primaryCtaHref?: string;
  secondaryCtaText?: string;
  secondaryCtaHref?: string;
  className?: string;
}

function getSettingsString(settings: unknown, key: string) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return '';
  const value = (settings as Record<string, unknown>)[key];
  return typeof value === 'string' ? value.trim() : '';
}

export default async function Hero(props: HeroProps) {
  const [business, systemPageHrefs] = await Promise.all([getBusiness(), getActiveSystemPageHrefs()]);
  const defaultPrimaryLabel = getSettingsString(business?.settings, 'primary_cta_label') || 'Get a Quote';
  const defaultSecondaryLabel = getSettingsString(business?.settings, 'secondary_cta_label') || 'Our Services';
  const defaultSecondaryHref = getSettingsString(business?.settings, 'secondary_cta_link') || systemPageHrefs.services || '/services';

  return (
    <SectionsHero
      {...props}
      primaryCtaText={defaultPrimaryLabel}
      primaryCtaHref={props.primaryCtaHref?.trim() || systemPageHrefs.contact || '/contact'}
      secondaryCtaText={defaultSecondaryLabel}
      secondaryCtaHref={defaultSecondaryHref}
    />
  );
}
