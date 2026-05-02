'use client';

import { useRef } from 'react';
import MediaPickerField from '@/components/backend/MediaPickerField';
import IconValue, { isIconImageValue } from '@/components/shared/IconValue';
import EntityIcon, { ENTITY_ICON_OPTIONS } from '@/components/shared/EntityIcon';

interface InlineEntityIconPickerProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}

export default function InlineEntityIconPicker({
  value,
  onChange,
  ariaLabel,
}: InlineEntityIconPickerProps) {
  const pickerRef = useRef<HTMLDetailsElement | null>(null);
  const imageValue = isIconImageValue(value) ? value : '';

  function closePicker() {
    pickerRef.current?.removeAttribute('open');
  }

  return (
    <details ref={pickerRef} className="service-icon-picker service-icon-picker--inline">
      <summary className="service-icon-picker__trigger" aria-label={ariaLabel}>
        <span className={`service-icon-picker__btn ${value ? 'service-icon-picker__btn--active' : ''}`}>
          {value ? <IconValue value={value} imageClassName="service-icon-picker__image" /> : <span aria-hidden="true">+</span>}
        </span>
      </summary>
      <div className="service-icon-picker__menu" role="group" aria-label={`${ariaLabel} options`}>
        <button
          type="button"
          className={`service-icon-picker__btn ${!value ? 'service-icon-picker__btn--active' : ''}`}
          onClick={() => {
            onChange('');
            closePicker();
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
            onChange(nextValue.trim());
            closePicker();
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
              onChange(option.value);
              closePicker();
            }}
            aria-label={option.label}
            title={option.label}
          >
            <EntityIcon name={option.value} />
          </button>
        ))}
      </div>
    </details>
  );
}
