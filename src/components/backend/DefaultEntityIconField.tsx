'use client';

import { useRef, useState } from 'react';
import MediaPickerField from '@/components/backend/MediaPickerField';
import IconValue, { isIconImageValue } from '@/components/shared/IconValue';
import EntityIcon, { ENTITY_ICON_OPTIONS } from '@/components/shared/EntityIcon';

interface DefaultEntityIconFieldProps {
  label: string;
  fieldName: string;
  initialValue?: string | null;
}

export default function DefaultEntityIconField({
  label,
  fieldName,
  initialValue = '',
}: DefaultEntityIconFieldProps) {
  const [value, setValue] = useState(initialValue ?? '');
  const pickerRef = useRef<HTMLDetailsElement | null>(null);
  const imageValue = isIconImageValue(value) ? value : '';

  return (
    <div className="settings-field--half default-entity-icon-field settings-templates-grid__cell">
      <input type="hidden" name={fieldName} value={value} readOnly />
      <label>{label}</label>
      <details ref={pickerRef} className="service-icon-picker service-icon-picker--inline">
        <summary className="service-icon-picker__trigger" aria-label={`Choose ${label.toLowerCase()}`}>
          <span className={`service-icon-picker__btn ${value ? 'service-icon-picker__btn--active' : ''}`}>
            {value ? <IconValue value={value} imageClassName="service-icon-picker__image" /> : <span aria-hidden="true">+</span>}
          </span>
        </summary>
        <div className="service-icon-picker__menu" role="group" aria-label={`${label} options`}>
          <button
            type="button"
            className={`service-icon-picker__btn ${!value ? 'service-icon-picker__btn--active' : ''}`}
            onClick={() => {
              setValue('');
              pickerRef.current?.removeAttribute('open');
            }}
            aria-label="No icon"
            title="No icon"
          >
            <span aria-hidden="true">-</span>
          </button>
          <MediaPickerField
            className="service-icon-picker__media-field"
            label="Icon Image"
            value={imageValue}
            onChange={(nextValue) => {
              setValue(nextValue.trim());
              pickerRef.current?.removeAttribute('open');
            }}
            mediaTab="icon"
            allowUpload
            uploadRole="icon"
            hideLabel
            hidePlaceholderText
          />
          {ENTITY_ICON_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`service-icon-picker__btn ${value === option.value ? 'service-icon-picker__btn--active' : ''}`}
              onClick={() => {
                setValue(option.value);
                pickerRef.current?.removeAttribute('open');
              }}
              aria-label={option.label}
              title={option.label}
            >
              <EntityIcon name={option.value} />
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
