'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Script from 'next/script';
import { getSectionsRuntime } from '@/lib/sections-core/lib/runtime';
import type { FrontendFormField } from '@/lib/sections-core/frontend';
import { serializeUploadedFormFileValue, type UploadedFormFileValue } from '@/lib/forms/uploads';
import { FORM_UPLOAD_ACCEPT_ATTRIBUTE, validateFormUploadFile } from '@/lib/forms/uploadValidation';

type ManagedFrontendFormField = FrontendFormField & {
  enableGoogleMaps?: boolean;
};

type ManagedFrontendFormClientProps = {
  businessId: string;
  formType?: 'contact' | 'quote_request' | 'booking' | 'newsletter';
  services?: Array<{ id: string; title: string }>;
  fields?: ManagedFrontendFormField[];
  formId?: string;
  submitLabel?: string;
  successTitle?: string;
  successMessage?: string;
  className?: string;
  recaptchaSiteKey?: string;
  googleMapsApiKey?: string;
};

declare global {
  interface GoogleMapsAddressComponent {
    long_name?: string;
    short_name?: string;
    types?: string[];
  }

  interface GoogleMapsPlaceResult {
    formatted_address?: string;
    address_components?: GoogleMapsAddressComponent[];
  }

  interface GoogleMapsAutocompleteInstance {
    addListener: (eventName: string, handler: () => void) => void;
    getPlace: () => GoogleMapsPlaceResult;
  }

  interface GoogleMapsPlacesLibrary {
    Autocomplete: new (
      input: HTMLInputElement,
      options?: {
        fields?: string[];
        types?: string[];
      }
    ) => GoogleMapsAutocompleteInstance;
  }

  interface Window {
    grecaptcha?: {
      ready?: (callback: () => void) => void;
      execute?: (siteKey: string, options: { action: string }) => Promise<string>;
      enterprise?: {
        ready?: (callback: () => void) => void;
        execute: (siteKey: string, options: { action: string }) => Promise<string>;
      };
    };
    google?: {
      maps?: {
        importLibrary?: (name: 'places') => Promise<GoogleMapsPlacesLibrary>;
        places?: GoogleMapsPlacesLibrary;
      };
    };
  }
}

const GRID_COLUMNS = 12;

function getAddressComponent(
  components: GoogleMapsAddressComponent[] | undefined,
  type: string,
  format: 'long_name' | 'short_name' = 'long_name'
) {
  return (
    components?.find((component) => Array.isArray(component.types) && component.types.includes(type))?.[format] ?? ''
  );
}

function parseGooglePlaceAddress(place: GoogleMapsPlaceResult) {
  const components = place.address_components ?? [];
  const streetNumber = getAddressComponent(components, 'street_number');
  const route = getAddressComponent(components, 'route');
  const city =
    getAddressComponent(components, 'locality') ||
    getAddressComponent(components, 'postal_town') ||
    getAddressComponent(components, 'sublocality_level_1');

  return {
    formattedAddress: (place.formatted_address ?? '').trim(),
    addressLine1: [streetNumber, route].filter(Boolean).join(' ').trim(),
    city: city.trim(),
    state: getAddressComponent(components, 'administrative_area_level_1', 'short_name').trim(),
    zip: getAddressComponent(components, 'postal_code').trim(),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeFields(fields: ManagedFrontendFormField[]) {
  return fields.map((field, index) => ({
    ...field,
    row: typeof field.row === 'number' && Number.isFinite(field.row) ? Math.max(1, Math.trunc(field.row)) : index + 1,
    span:
      typeof field.span === 'number' && Number.isFinite(field.span) ? clamp(Math.trunc(field.span), 1, GRID_COLUMNS) : 12,
    enableGoogleMaps: field.type === 'address' ? field.enableGoogleMaps !== false : undefined,
  }));
}

async function uploadSingleFormFile(file: File, businessId: string) {
  validateFormUploadFile(file);

  const uploadFormData = new FormData();
  uploadFormData.set('business_id', businessId);
  uploadFormData.set('file', file);

  const response = await fetch('/api/forms/upload', {
    method: 'POST',
    body: uploadFormData,
  });

  const payload = (await response.json().catch(() => null)) as UploadedFormFileValue | { error?: string } | null;
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
      ? payload.error
      : 'Unable to upload file. Please try again.';
    throw new Error(message);
  }

  return payload as UploadedFormFileValue;
}

async function getRecaptchaToken(siteKey: string) {
  if (typeof window === 'undefined') {
    throw new Error('Spam protection is still loading. Please try again.');
  }

  const grecaptcha = window.grecaptcha;
  const enterprise = grecaptcha?.enterprise;
  const execute = enterprise?.execute?.bind(enterprise) ?? grecaptcha?.execute?.bind(grecaptcha);
  if (!execute) {
    throw new Error('Spam protection is still loading. Please try again.');
  }

  return await new Promise<string>((resolve, reject) => {
    const executeToken = () => {
      execute(siteKey, { action: 'frontend_form_submit' })
        .then(resolve)
        .catch(() => reject(new Error('Unable to verify spam protection. Please try again.')));
    };

    if (typeof enterprise?.ready === 'function') {
      enterprise.ready(executeToken);
      return;
    }

    if (typeof grecaptcha?.ready === 'function') {
      grecaptcha.ready(executeToken);
      return;
    }

    executeToken();
  });
}

export default function ManagedFrontendFormClient({
  businessId,
  formType = 'contact',
  services = [],
  fields,
  formId,
  submitLabel = 'Submit',
  successTitle = 'Thanks!',
  successMessage = 'Your form has been submitted.',
  className = 'contact-form',
  recaptchaSiteKey = '',
  googleMapsApiKey = '',
}: ManagedFrontendFormClientProps) {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [recaptchaState, setRecaptchaState] = useState<'idle' | 'loaded' | 'error'>(
    recaptchaSiteKey ? 'idle' : 'loaded'
  );
  const [mapsState, setMapsState] = useState<'idle' | 'loaded' | 'error'>(googleMapsApiKey ? 'idle' : 'error');
  const addressInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const addressLine1HiddenRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const addressCityHiddenRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const addressStateHiddenRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const addressZipHiddenRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const initializedAddressFieldsRef = useRef<Set<string>>(new Set());
  const normalizedFields = useMemo(
    () => (Array.isArray(fields) ? normalizeFields(fields.filter((field) => field.name && field.label)) : []),
    [fields]
  );
  const hasAddressField = useMemo(
    () => normalizedFields.some((field) => field.type === 'address' && field.enableGoogleMaps !== false),
    [normalizedFields]
  );

  const rows = useMemo(() => {
    const grouped = new Map<number, ManagedFrontendFormField[]>();
    normalizedFields.forEach((field) => {
      const row = field.row ?? 1;
      if (!grouped.has(row)) grouped.set(row, []);
      grouped.get(row)?.push(field);
    });
    return Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);
  }, [normalizedFields]);

  useEffect(() => {
    if (!hasAddressField || mapsState !== 'loaded' || typeof window === 'undefined') return;

    let cancelled = false;

    async function attachAutocomplete() {
      try {
        const maps = window.google?.maps;
        if (!maps) return;
        const placesLibrary =
          maps.places ??
          (typeof maps.importLibrary === 'function' ? await maps.importLibrary('places') : undefined);
        if (!placesLibrary?.Autocomplete || cancelled) return;

        normalizedFields.forEach((field) => {
          if (field.type !== 'address' || field.enableGoogleMaps === false) return;
          if (initializedAddressFieldsRef.current.has(field.id)) return;

          const input = addressInputRefs.current[field.id];
          if (!input) return;

          const autocomplete = new placesLibrary.Autocomplete(input, {
            fields: ['formatted_address', 'address_components'],
            types: ['address'],
          });

          autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            const parsedAddress = parseGooglePlaceAddress(place);
            if (parsedAddress.formattedAddress) {
              input.value = parsedAddress.formattedAddress;
            }
            if (addressLine1HiddenRefs.current[field.id]) {
              addressLine1HiddenRefs.current[field.id]!.value = parsedAddress.addressLine1;
            }
            if (addressCityHiddenRefs.current[field.id]) {
              addressCityHiddenRefs.current[field.id]!.value = parsedAddress.city;
            }
            if (addressStateHiddenRefs.current[field.id]) {
              addressStateHiddenRefs.current[field.id]!.value = parsedAddress.state;
            }
            if (addressZipHiddenRefs.current[field.id]) {
              addressZipHiddenRefs.current[field.id]!.value = parsedAddress.zip;
            }
          });

          initializedAddressFieldsRef.current.add(field.id);
        });
      } catch {
        if (!cancelled) {
          setMapsState('error');
        }
      }
    }

    void attachAutocomplete();

    return () => {
      cancelled = true;
    };
  }, [hasAddressField, mapsState, normalizedFields]);

  function renderField(field: ManagedFrontendFormField) {
    const fieldId = `${formType}_${field.name}`;
    const placeholder = field.placeholder ?? '';
    const style = { '--contact-field-span': String(field.span ?? GRID_COLUMNS) } as React.CSSProperties;

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
          <input
            id={fieldId}
            name={field.name}
            type="file"
            accept={FORM_UPLOAD_ACCEPT_ATTRIBUTE}
            required={field.required === true}
          />
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
          onChange={
            field.type === 'address'
              ? () => {
                  if (addressLine1HiddenRefs.current[field.id]) addressLine1HiddenRefs.current[field.id]!.value = '';
                  if (addressCityHiddenRefs.current[field.id]) addressCityHiddenRefs.current[field.id]!.value = '';
                  if (addressStateHiddenRefs.current[field.id]) addressStateHiddenRefs.current[field.id]!.value = '';
                  if (addressZipHiddenRefs.current[field.id]) addressZipHiddenRefs.current[field.id]!.value = '';
                }
              : undefined
          }
          ref={
            field.type === 'address'
              ? (node) => {
                  addressInputRefs.current[field.id] = node;
                }
              : undefined
          }
        />
        {field.type === 'address' ? (
          <>
            <input
              type="hidden"
              name={`${field.name}__address_line1`}
              ref={(node) => {
                addressLine1HiddenRefs.current[field.id] = node;
              }}
            />
            <input
              type="hidden"
              name={`${field.name}__city`}
              ref={(node) => {
                addressCityHiddenRefs.current[field.id] = node;
              }}
            />
            <input
              type="hidden"
              name={`${field.name}__state`}
              ref={(node) => {
                addressStateHiddenRefs.current[field.id] = node;
              }}
            />
            <input
              type="hidden"
              name={`${field.name}__zip`}
              ref={(node) => {
                addressZipHiddenRefs.current[field.id] = node;
              }}
            />
          </>
        ) : null}
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

      const fileFields = normalizedFields.filter((field) => field.type === 'file');
      for (const field of fileFields) {
        const fieldValues = formData.getAll(field.name);
        const files = fieldValues.filter((value): value is File => value instanceof File && value.size > 0 && Boolean(value.name.trim()));
        if (files.length === 0) continue;

        formData.delete(field.name);

        const uploadedFiles = await Promise.all(files.map((file) => uploadSingleFormFile(file, businessId)));
        uploadedFiles.forEach((uploadedFile) => {
          formData.append(field.name, serializeUploadedFormFileValue(uploadedFile));
        });
      }

      if (recaptchaSiteKey) {
        if (recaptchaState === 'error') {
          throw new Error('Spam protection failed to load. Please refresh the page and try again.');
        }
        const recaptchaToken = await getRecaptchaToken(recaptchaSiteKey);
        formData.set('recaptcha_token', recaptchaToken);
        formData.set('recaptcha_action', 'frontend_form_submit');
      }

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
    <>
      {recaptchaSiteKey ? (
        <Script
          src={`https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(recaptchaSiteKey)}`}
          strategy="afterInteractive"
          onReady={() => setRecaptchaState('loaded')}
          onError={() => setRecaptchaState('error')}
        />
      ) : null}
      {hasAddressField && googleMapsApiKey ? (
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsApiKey)}&libraries=places`}
          strategy="afterInteractive"
          onLoad={() => setMapsState('loaded')}
          onReady={() => setMapsState('loaded')}
          onError={() => setMapsState('error')}
        />
      ) : null}
      <style jsx global>{`
        .site .contact-form__grid[data-builder-layout='custom'] > .contact-form__field {
          grid-column: span var(--contact-field-span, 12) !important;
        }

        @media (max-width: 700px) {
          .site .contact-form__grid[data-builder-layout='custom'] > .contact-form__field {
            grid-column: 1 / -1 !important;
          }
        }
      `}</style>
      <form className={className} onSubmit={handleSubmit}>
        {formId ? <input type="hidden" name="form_id" value={formId} /> : null}
        {normalizedFields.length > 0 ? (
          <div className="contact-form__grid" data-builder-layout="custom">
            {rows.flatMap(([, rowFields]) => rowFields.map(renderField))}
          </div>
        ) : null}
        {status === 'error' && error && <p className="form-error">{error}</p>}
        <button
          type="submit"
          className="btn btn--primary"
          disabled={status === 'submitting' || (Boolean(recaptchaSiteKey) && recaptchaState === 'error')}
        >
          {status === 'submitting' ? 'Sending...' : submitLabel}
        </button>
      </form>
    </>
  );
}
