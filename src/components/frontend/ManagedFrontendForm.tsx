import type { ComponentProps } from 'react';
import type { FrontendForm } from '@/lib/sections-core/frontend';
import { getActiveFormById } from '@/lib/forms/queries';
import ManagedFrontendFormClient from '@/components/frontend/ManagedFrontendFormClient';

type ManagedFrontendFormProps = ComponentProps<typeof FrontendForm>;

export default async function ManagedFrontendForm(props: ManagedFrontendFormProps) {
  const formId = typeof props.formId === 'string' ? props.formId.trim() : '';
  const form = formId ? await getActiveFormById(formId) : null;
  const thankYouMessage =
    typeof form?.thank_you_message === 'string' && form.thank_you_message.trim()
      ? form.thank_you_message.trim()
      : props.successMessage;
  const recaptchaSiteKey =
    process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() ||
    process.env.GOOGLE_RECAPTCHA_SITE_KEY?.trim() ||
    '';
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || '';

  return (
    <ManagedFrontendFormClient
      {...props}
      successMessage={thankYouMessage}
      recaptchaSiteKey={recaptchaSiteKey}
      googleMapsApiKey={googleMapsApiKey}
    />
  );
}
