'use client';

import { trackEvent } from '@/components/analytics/NativeAnalytics';
import { formatPhone } from '@/lib/utils';

type TrackedPhoneLinkProps = {
  phone: string;
  className?: string;
};

function toTelHref(phone: string) {
  const normalized = phone.trim().replace(/[^+\d]/g, '');
  return `tel:${normalized}`;
}

export default function TrackedPhoneLink({
  phone,
  className,
}: TrackedPhoneLinkProps) {
  return (
    <a
      href={toTelHref(phone)}
      className={className}
      onClick={() => trackEvent('phone_click')}
    >
      {formatPhone(phone)}
    </a>
  );
}
