'use client';

import { useMemo, useState } from 'react';
import type { BusinessLicense } from '@/lib/utils/licenses';
import { parseBusinessLicenses } from '@/lib/utils/licenses';

interface LicenseNumbersFieldProps {
  initialValue?: BusinessLicense[] | null;
}

function createEmptyLicense(): BusinessLicense {
  return { label: '', number: '' };
}

export default function LicenseNumbersField({ initialValue }: LicenseNumbersFieldProps) {
  const [licenses, setLicenses] = useState<BusinessLicense[]>(() => {
    const parsed = parseBusinessLicenses(initialValue ?? []);
    return parsed.length > 0 ? parsed : [createEmptyLicense()];
  });

  const serialized = useMemo(
    () =>
      JSON.stringify(
        licenses
          .map((license) => ({
            label: license.label.trim(),
            number: license.number.trim(),
          }))
          .filter((license) => license.label || license.number),
      ),
    [licenses],
  );

  return (
    <div className="license-numbers-field">
      <input type="hidden" name="license_numbers_config" value={serialized} />

      <div className="license-numbers-field__list">
        {licenses.map((license, index) => (
          <div key={`${index}-${license.label}-${license.number}`} className="license-numbers-field__row">
            <label>
              <span>Label</span>
              <input
                type="text"
                value={license.label}
                onChange={(event) =>
                  setLicenses((current) =>
                    current.map((entry, entryIndex) =>
                      entryIndex === index ? { ...entry, label: event.target.value } : entry,
                    ),
                  )
                }
                placeholder="HIC, MHIC, License, etc."
              />
            </label>
            <label>
              <span>Number</span>
              <input
                type="text"
                value={license.number}
                onChange={(event) =>
                  setLicenses((current) =>
                    current.map((entry, entryIndex) =>
                      entryIndex === index ? { ...entry, number: event.target.value } : entry,
                    ),
                  )
                }
                placeholder="123456"
              />
            </label>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() =>
                setLicenses((current) => (current.length > 1 ? current.filter((_, entryIndex) => entryIndex !== index) : [createEmptyLicense()]))
              }
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="license-numbers-field__actions">
        <button
          type="button"
          className="btn"
          onClick={() => setLicenses((current) => [...current, createEmptyLicense()])}
        >
          Add License Number
        </button>
      </div>
    </div>
  );
}
