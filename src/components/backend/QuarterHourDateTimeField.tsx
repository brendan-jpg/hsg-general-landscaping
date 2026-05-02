'use client';

import { ChangeEvent } from 'react';

const QUARTER_HOUR_MINUTES = 15;
const DEFAULT_TIME = '00:00';

const TIME_OPTIONS = Array.from({ length: (24 * 60) / QUARTER_HOUR_MINUTES }, (_, index) => {
  const totalMinutes = index * QUARTER_HOUR_MINUTES;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const value = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  const label = `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;

  return { value, label };
});

export function toQuarterHourDateTimeLocalValue(value: string | null | undefined) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);

  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  rounded.setMinutes(Math.round(rounded.getMinutes() / QUARTER_HOUR_MINUTES) * QUARTER_HOUR_MINUTES);

  const local = new Date(rounded.getTime() - rounded.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

interface QuarterHourDateTimeFieldProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  dateAriaLabel?: string;
  timeAriaLabel?: string;
}

export default function QuarterHourDateTimeField({
  value,
  onChange,
  required = false,
  disabled = false,
  dateAriaLabel = 'Date',
  timeAriaLabel = 'Time',
}: QuarterHourDateTimeFieldProps) {
  const normalizedValue = toQuarterHourDateTimeLocalValue(value);
  const datePart = normalizedValue ? normalizedValue.slice(0, 10) : '';
  const timePart = normalizedValue ? normalizedValue.slice(11, 16) : '';

  function handleDateChange(event: ChangeEvent<HTMLInputElement>) {
    const nextDate = event.target.value;

    if (!nextDate) {
      onChange('');
      return;
    }

    onChange(`${nextDate}T${timePart || DEFAULT_TIME}`);
  }

  function handleTimeChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextTime = event.target.value;

    if (!datePart) {
      onChange('');
      return;
    }

    onChange(`${datePart}T${nextTime}`);
  }

  return (
    <div className="quarter-hour-datetime-field">
      <input
        type="date"
        value={datePart}
        onChange={handleDateChange}
        required={required}
        disabled={disabled}
        aria-label={dateAriaLabel}
      />
      <select
        value={timePart}
        onChange={handleTimeChange}
        required={required}
        disabled={disabled || !datePart}
        aria-label={timeAriaLabel}
      >
        <option value="" disabled>
          Select time
        </option>
        {TIME_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
