export const BUSINESS_TIMEZONE_OPTIONS = [
  ['America/New_York', 'Eastern Time'],
  ['America/Chicago', 'Central Time'],
  ['America/Denver', 'Mountain Time'],
  ['America/Phoenix', 'Arizona Time'],
  ['America/Los_Angeles', 'Pacific Time'],
  ['America/Anchorage', 'Alaska Time'],
  ['Pacific/Honolulu', 'Hawaii Time'],
] as const;

export const BUSINESS_TIMEZONE_VALUES = BUSINESS_TIMEZONE_OPTIONS.map(([value]) => value);

export function normalizeBusinessTimezone(value: string | null | undefined) {
  const normalized = (value ?? '').trim();
  if (!normalized) return 'America/New_York';
  return BUSINESS_TIMEZONE_VALUES.includes(normalized as (typeof BUSINESS_TIMEZONE_VALUES)[number])
    ? normalized
    : 'America/New_York';
}
