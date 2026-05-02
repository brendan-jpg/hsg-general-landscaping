export interface BusinessLicense {
  label: string;
  number: string;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function parseBusinessLicenses(value: unknown): BusinessLicense[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => {
      const obj = asObject(entry);
      const label = typeof obj.label === 'string' ? obj.label.trim() : '';
      const number = typeof obj.number === 'string' ? obj.number.trim() : '';
      if (!label && !number) return null;
      return { label, number };
    })
    .filter((entry): entry is BusinessLicense => Boolean(entry?.label || entry?.number));
}

export function formatBusinessLicensesMarkdown(licenses: BusinessLicense[]) {
  return licenses
    .map((license) => {
      if (license.label && license.number) return `- ${license.label}: ${license.number}`;
      return `- ${license.label || license.number}`;
    })
    .join('\n');
}
