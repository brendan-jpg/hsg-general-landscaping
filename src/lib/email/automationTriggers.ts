export const PLATFORM_AUTOMATION_TRIGGER_OPTIONS = [
  { value: 'new_invoice', label: 'New invoice' },
  { value: 'new_estimate', label: 'New Estimate' },
  { value: 'review_request', label: 'Review Request' },
  { value: 'lead_notification', label: 'Lead notification' },
  { value: 'inquiry_response', label: 'Inquiry Response' },
] as const;

export type PlatformAutomationTriggerValue = (typeof PLATFORM_AUTOMATION_TRIGGER_OPTIONS)[number]['value'];

export const PLATFORM_AUTOMATION_TRIGGER_VALUES = PLATFORM_AUTOMATION_TRIGGER_OPTIONS.map(
  (option) => option.value,
) as PlatformAutomationTriggerValue[];

export function formatAutomationTriggerLabel(value: string) {
  return (
    PLATFORM_AUTOMATION_TRIGGER_OPTIONS.find((option) => option.value === value)?.label ??
    value
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  );
}
