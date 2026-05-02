'use client';

import { useMemo, useState } from 'react';
import { getSectionsRuntime } from '../lib/runtime';
import PrimaryButton from '../components/ui/PrimaryButton';

export type FrontendFormFieldType =
  | 'text'
  | 'address'
  | 'textarea'
  | 'email'
  | 'tel'
  | 'number'
  | 'select'
  | 'checkbox'
  | 'file';

export interface FrontendFormField {
  id: string;
  name: string;
  label: string;
  type: FrontendFormFieldType;
  placeholder?: string;
  required?: boolean;
  helpText?: string;
  options?: string[];
  row?: number;
  span?: number;
}

interface FrontendFormProps {
  businessId: string;
  formType?: 'contact' | 'quote_request' | 'booking' | 'newsletter';
  services?: Array<{ id: string; title: string }>;
  fields?: FrontendFormField[];
  formId?: string;
  submitLabel?: string;
  successTitle?: string;
  successMessage?: string;
  className?: string;
}

const GRID_COLUMNS = 12;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeFields(fields: FrontendFormField[]) {
  return fields.map((field, index) => ({
    ...field,
    row: typeof field.row === 'number' && Number.isFinite(field.row) ? Math.max(1, Math.trunc(field.row)) : index + 1,
    span:
      typeof field.span === 'number' && Number.isFinite(field.span) ? clamp(Math.trunc(field.span), 1, GRID_COLUMNS) : 12,
  }));
}

export default function FrontendForm({
  businessId,
  formType = 'contact',
  services = [],
  fields,
  formId,
  submitLabel = 'Submit',
  successTitle = 'Thanks!',
  successMessage = 'Your form has been submitted.',
  className = 'contact-form',
}: FrontendFormProps) {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const normalizedFields = useMemo(
    () => (Array.isArray(fields) ? normalizeFields(fields.filter((field) => field.name && field.label)) : []),
    [fields]
  );

  const rows = useMemo(() => {
    const grouped = new Map<number, FrontendFormField[]>();
    normalizedFields.forEach((field) => {
      const row = field.row ?? 1;
      if (!grouped.has(row)) grouped.set(row, []);
      grouped.get(row)?.push(field);
    });
    return Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);
  }, [normalizedFields]);

  function renderField(field: FrontendFormField) {
    const fieldId = `${formType}_${field.name}`;
    const placeholder = field.placeholder ?? '';
    const style = { gridColumn: `span ${field.span ?? GRID_COLUMNS}` } as const;

    if (field.type === 'textarea') {
      return (
        <div key={field.id} className="contact-form__field" style={style}>
          <label htmlFor={fieldId}>{field.label}</label>
          <textarea id={fieldId} name={field.name} rows={5} required={field.required === true} placeholder={placeholder} />
          {field.helpText && <small>{field.helpText}</small>}
        </div>
      );
    }

    if (field.type === 'select') {
      const options = (field.options ?? []).filter(Boolean);
      const shouldUseServices = options.length === 0 && /service/i.test(field.name);
      const optionValues = shouldUseServices ? services.map((service) => service.title) : options;

      return (
        <div key={field.id} className="contact-form__field" style={style}>
          <label htmlFor={fieldId}>{field.label}</label>
          <select id={fieldId} name={field.name} required={field.required === true} defaultValue="">
            <option value="">{placeholder || `Select ${field.label.toLowerCase()}...`}</option>
            {optionValues.map((option, optionIndex) => (
              <option key={`${option}-${optionIndex}`} value={option}>
                {option}
              </option>
            ))}
          </select>
          {field.helpText && <small>{field.helpText}</small>}
        </div>
      );
    }

    if (field.type === 'checkbox') {
      const options = (field.options ?? []).filter(Boolean);
      const shouldUseServices = options.length === 0 && /service/i.test(field.name);
      const dynamicOptions = shouldUseServices ? services.map((service) => service.title) : options;
      const optionValues = dynamicOptions.includes('Other') ? dynamicOptions : [...dynamicOptions, 'Other'];

      if (optionValues.length > 0) {
        return (
          <fieldset key={field.id} className="contact-form__field" style={style}>
            <legend>{field.label}</legend>
            <div className="contact-form__checkbox-group">
              {optionValues.map((option, optionIndex) => {
                const optionId = `${fieldId}_${optionIndex}`;
                return (
                  <label key={`${field.id}_${optionIndex}`} htmlFor={optionId}>
                    <input id={optionId} name={field.name} type="checkbox" value={option} /> {option}
                  </label>
                );
              })}
            </div>
            {field.helpText && <small>{field.helpText}</small>}
          </fieldset>
        );
      }

      return (
        <div key={field.id} className="contact-form__field" style={style}>
          <label htmlFor={fieldId}>
            <input id={fieldId} name={field.name} type="checkbox" required={field.required === true} /> {field.label}
          </label>
          {field.helpText && <small>{field.helpText}</small>}
        </div>
      );
    }

    if (field.type === 'file') {
      return (
        <div key={field.id} className="contact-form__field" style={style}>
          <label htmlFor={fieldId}>{field.label}</label>
          <input id={fieldId} name={field.name} type="file" required={field.required === true} />
          {field.helpText && <small>{field.helpText}</small>}
        </div>
      );
    }

    const inputType =
      field.type === 'number' ? 'number' : field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'text';
    return (
      <div key={field.id} className="contact-form__field" style={style}>
        <label htmlFor={fieldId}>{field.label}</label>
        <input
          id={fieldId}
          name={field.name}
          type={inputType}
          required={field.required === true}
          placeholder={placeholder}
          autoComplete={field.type === 'address' ? 'street-address' : undefined}
        />
        {field.helpText && <small>{field.helpText}</small>}
      </div>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('submitting');
    setError(null);

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
      for (const field of normalizedFields) {
        if (field.type !== 'checkbox' || field.required !== true) continue;
        const options = (field.options ?? []).filter(Boolean);
        const shouldUseServices = options.length === 0 && /service/i.test(field.name);
        const hasOptionGroup = shouldUseServices || options.length > 0;
        if (!hasOptionGroup) continue;
        if (formData.getAll(field.name).length === 0) {
          throw new Error(`${field.label} is required`);
        }
      }

      formData.set('business_id', businessId);
      formData.set('form_type', formType);
      formData.set('page_url', window.location.href);

      const params = new URLSearchParams(window.location.search);
      formData.set('utm_source', params.get('utm_source') ?? '');
      formData.set('utm_medium', params.get('utm_medium') ?? '');
      formData.set('utm_campaign', params.get('utm_campaign') ?? '');

      await getSectionsRuntime().actions.submitForm(formData);
      getSectionsRuntime().analytics.trackEvent('form_submit');
      form.reset();
      setStatus('success');
    } catch (submitError) {
      setStatus('error');
      setError(submitError instanceof Error ? submitError.message : 'Unable to send your message');
    }
  }

  if (status === 'success') {
    return (
      <div className="contact-form__success">
        <h3>{successTitle}</h3>
        <p>{successMessage}</p>
      </div>
    );
  }

  return (
    <form className={className} onSubmit={handleSubmit}>
      {formId ? <input type="hidden" name="form_id" value={formId} /> : null}
      {normalizedFields.length > 0 ? (
        <div className="contact-form__grid">
          {rows.flatMap(([, rowFields]) => rowFields.map(renderField))}
        </div>
      ) : null}
      {status === 'error' && error && <p className="form-error">{error}</p>}
      <PrimaryButton type="submit" disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Sending...' : submitLabel}
      </PrimaryButton>
    </form>
  );
}


