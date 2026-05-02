'use client';

import { ChangeEvent, FormEvent, useActionState, useEffect, useRef, useState } from 'react';
import { createFreeTrialTenantAction } from '@/lib/actions';
import PendingSubmitButton from '@/components/backend/PendingSubmitButton';
import AppImage from '@/components/shared/AppImage';
import {
  FREE_TRIAL_INDUSTRY_PRESETS,
  getFreeTrialIndustryPreset,
  type FreeTrialIndustryKey,
} from '@/lib/freeTrial/presets';
import { US_STATE_OPTIONS } from '@/lib/usStates';

type TrialState = {
  error: string | null;
  success: string | null;
  businessName?: string;
  previewUrl?: string;
  dashboardUrl?: string;
  slug?: string;
  inviteEmailSent?: boolean;
};

const initialState: TrialState = {
  error: null,
  success: null,
};

export default function FreeTrialOnboardingForm() {
  const formRef = useRef<HTMLFormElement | null>(null);
  const cleanupUrlsRef = useRef<string[]>([]);
  const [state, submitAction, isPending] = useActionState(createFreeTrialTenantAction, initialState);
  const [clientError, setClientError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [industry, setIndustry] = useState<FreeTrialIndustryKey>('landscaping');
  const [selectedServices, setSelectedServices] = useState<string[]>(
    getFreeTrialIndustryPreset('landscaping').services.map((service) => service.title),
  );
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [servicePreviewUrls, setServicePreviewUrls] = useState<Record<string, string>>({});
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      setClientError(null);
      setIndustry('landscaping');
      setSelectedServices(getFreeTrialIndustryPreset('landscaping').services.map((service) => service.title));
      setLogoPreviewUrl(null);
      setServicePreviewUrls({});
      setCurrentStep(0);
    }
  }, [state.success]);

  useEffect(() => {
    if (!redirectUrl) return;
    window.location.assign(redirectUrl);
  }, [redirectUrl]);

  useEffect(() => {
    if (!state.success || !state.previewUrl || redirectUrl) return;
    const dashboardContinueUrl = state.dashboardUrl
      ? `${state.dashboardUrl}?email=${encodeURIComponent(submittedEmail)}&next=${encodeURIComponent('/dashboard?welcome=1')}`
      : null;
    const previewRedirectUrl = dashboardContinueUrl
      ? `${state.previewUrl}?trial=1&dashboard=${encodeURIComponent(dashboardContinueUrl)}`
      : state.previewUrl;
    setRedirectUrl(previewRedirectUrl);
  }, [redirectUrl, state.dashboardUrl, state.previewUrl, state.success, submittedEmail]);

  useEffect(() => {
    return () => {
      cleanupUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      cleanupUrlsRef.current = [];
    };
  }, []);

  const serviceOptions = getFreeTrialIndustryPreset(industry).services;
  const stepCount = 3;

  function handleIndustryChange(nextIndustry: FreeTrialIndustryKey) {
    setIndustry(nextIndustry);
    setSelectedServices(getFreeTrialIndustryPreset(nextIndustry).services.map((service) => service.title));
    setClientError(null);
  }

  function handleServiceChange(serviceTitle: string, checked: boolean) {
    setSelectedServices((current) => {
      if (checked) {
        return current.includes(serviceTitle) ? current : [...current, serviceTitle];
      }
      return current.filter((value) => value !== serviceTitle);
    });
    setClientError(null);
  }

  function createPreviewUrl(file: File | null) {
    if (!file) return null;
    const url = URL.createObjectURL(file);
    cleanupUrlsRef.current.push(url);
    return url;
  }

  function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setLogoPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return createPreviewUrl(file);
    });
  }

  function handleServiceImageChange(serviceSlug: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setServicePreviewUrls((current) => {
      const next = { ...current };
      if (next[serviceSlug]) {
        URL.revokeObjectURL(next[serviceSlug]);
        delete next[serviceSlug];
      }
      const previewUrl = createPreviewUrl(file);
      if (previewUrl) next[serviceSlug] = previewUrl;
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get('password') ?? '');
    const confirmPassword = String(formData.get('confirm_password') ?? '');
    const email = String(formData.get('email') ?? '').trim();
    const zip = String(formData.get('zip') ?? '').replace(/\D+/g, '');
    const selectedState = String(formData.get('state') ?? '').trim().toUpperCase();

    if (password.length < 8) {
      event.preventDefault();
      setClientError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      event.preventDefault();
      setClientError('Passwords do not match.');
      return;
    }

    if (selectedServices.length === 0) {
      event.preventDefault();
      setClientError('Select at least one service.');
      return;
    }

    if (zip.length !== 5) {
      event.preventDefault();
      setClientError('Enter a valid 5-digit ZIP code.');
      return;
    }

    if (!selectedState) {
      event.preventDefault();
      setClientError('Select a state.');
      return;
    }

    setClientError(null);
    setSubmittedEmail(email);
  }

  function goToStep(nextStep: number) {
    setCurrentStep(Math.max(0, Math.min(stepCount - 1, nextStep)));
    setClientError(null);
  }

  function validateStepFields(fieldNames: string[]) {
    if (!formRef.current) return true;

    for (const fieldName of fieldNames) {
      const field = formRef.current.elements.namedItem(fieldName);
      if (!(field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement)) {
        continue;
      }
      if (!field.reportValidity()) return false;
    }

    return true;
  }

  function continueFromBusinessStep() {
    if (!validateStepFields(['business_name', 'phone', 'state', 'zip'])) return;
    goToStep(1);
  }

  function continueFromOwnerStep() {
    if (!validateStepFields(['owner_first_name', 'owner_last_name', 'email', 'password', 'confirm_password'])) {
      return;
    }

    if (!formRef.current) {
      goToStep(2);
      return;
    }

    const passwordField = formRef.current.elements.namedItem('password');
    const confirmPasswordField = formRef.current.elements.namedItem('confirm_password');
    const passwordValue = passwordField instanceof HTMLInputElement ? passwordField.value : '';
    const confirmPasswordValue = confirmPasswordField instanceof HTMLInputElement ? confirmPasswordField.value : '';

    if (passwordValue !== confirmPasswordValue) {
      setClientError('Passwords do not match.');
      return;
    }

    goToStep(2);
  }

  if (state.success && state.previewUrl) {
    const dashboardContinueUrl = state.dashboardUrl
      ? `${state.dashboardUrl}?email=${encodeURIComponent(submittedEmail)}&next=${encodeURIComponent('/dashboard?welcome=1')}`
      : null;
    const previewRedirectUrl = dashboardContinueUrl
      ? `${state.previewUrl}?trial=1&dashboard=${encodeURIComponent(dashboardContinueUrl)}`
      : state.previewUrl;

    return (
      <section className="trial-result" aria-label="Trial site created">
        <span className="auth-card__eyebrow">Trial Ready</span>
        <h1 className="auth-card__title">Launching {state.businessName || 'your site'}</h1>
        <p className="auth-card__subtitle">
          We&apos;re sending you to the new homepage now so you can explore it first.
        </p>
        <p className="trial-result__note">If the redirect doesn&apos;t happen automatically, use the button below.</p>
        <a className="btn btn--primary btn--lg" href={previewRedirectUrl}>
          Go To New Site
        </a>
      </section>
    );
  }

  return (
    <form ref={formRef} className="trial-form" action={submitAction} onSubmit={handleSubmit}>
      <input type="hidden" name="industry" value={industry} />
      {selectedServices.map((service) => (
        <input key={service} type="hidden" name="services" value={service} />
      ))}

      <section className="trial-form__intro" aria-label="Trial setup overview">
        <div className="trial-form__intro-copy">
          <p className="trial-form__intro-kicker">Step {currentStep + 1} of 3</p>
        </div>

        <div className="trial-form__progress" aria-label="Trial setup progress">
          {[1, 2, 3].map((stepNumber, index) => (
            <button
              key={stepNumber}
              type="button"
              className={`trial-form__progress-step${index === currentStep ? ' trial-form__progress-step--active' : ''}${index < currentStep ? ' trial-form__progress-step--done' : ''}`}
              onClick={() => goToStep(index)}
              aria-label={`Go to step ${stepNumber}`}
            >
              <span>{stepNumber}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="trial-form__section" hidden={currentStep !== 0} aria-hidden={currentStep !== 0}>
          <div className="trial-form__grid">
            <div className="trial-form__field trial-form__field--wide">
              <label htmlFor="business_name">What&apos;s your business called?</label>
              <input
                id="business_name"
                name="business_name"
                type="text"
                autoComplete="organization"
                placeholder="Evergreen Outdoor Living"
                required
              />
            </div>

            <div className="trial-form__field trial-form__field--wide">
              <label>What kind of business is it?</label>
              <div className="trial-form__choice-grid" role="radiogroup" aria-label="Business type">
                {FREE_TRIAL_INDUSTRY_PRESETS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`trial-form__choice-card${industry === option.key ? ' trial-form__choice-card--active' : ''}`}
                    onClick={() => handleIndustryChange(option.key)}
                    aria-pressed={industry === option.key}
                  >
                    <strong>{option.label}</strong>
                  </button>
                ))}
              </div>
            </div>

            <div className="trial-form__field">
              <label htmlFor="phone">What phone number should we use?</label>
              <input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="(860) 555-0142" required />
            </div>

            <div className="trial-form__field">
              <label htmlFor="state">What state should we use?</label>
              <select id="state" name="state" autoComplete="address-level1" required defaultValue="">
                <option value="" disabled>
                  Select a state
                </option>
                {US_STATE_OPTIONS.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
              <p className="trial-form__hint">Used for your stored state code and market setup.</p>
            </div>

            <div className="trial-form__field">
              <label htmlFor="zip">What ZIP should we build around?</label>
              <input
                id="zip"
                name="zip"
                type="text"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={5}
                pattern="[0-9]{5}"
                placeholder="06103"
                required
              />
              <p className="trial-form__hint">Used for the primary market and nearby areas.</p>
            </div>

            <div className="trial-form__field trial-form__field--wide">
              <label htmlFor="logo_file">Want to add a logo now?</label>
              <input id="logo_file" name="logo_file" type="file" accept="image/*" onChange={handleLogoChange} />
              <p className="trial-form__hint">Optional.</p>
              {logoPreviewUrl ? (
                <div className="trial-form__upload-preview trial-form__upload-preview--logo">
                  <AppImage role="logo" src={logoPreviewUrl} alt="Logo preview" width={240} height={140} />
                </div>
              ) : null}
            </div>
          </div>

          <div className="trial-form__actions">
            <button type="button" className="btn btn--primary btn--lg" onClick={continueFromBusinessStep}>
              Continue
            </button>
          </div>
        </section>

      <section className="trial-form__section" hidden={currentStep !== 1} aria-hidden={currentStep !== 1}>
          <div className="trial-form__grid">
            <div className="trial-form__field">
              <label htmlFor="owner_first_name">What&apos;s your first name?</label>
              <input id="owner_first_name" name="owner_first_name" type="text" autoComplete="given-name" placeholder="Brendan" required />
            </div>

            <div className="trial-form__field">
              <label htmlFor="owner_last_name">And your last name?</label>
              <input id="owner_last_name" name="owner_last_name" type="text" autoComplete="family-name" placeholder="McNulty" required />
            </div>

            <div className="trial-form__field trial-form__field--wide">
              <label htmlFor="email">What email should we use for login?</label>
              <input id="email" name="email" type="email" autoComplete="email" placeholder="owner@business.com" required />
            </div>

            <div className="trial-form__field">
              <label htmlFor="password">Choose a password</label>
              <input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
              <p className="trial-form__hint">Use at least 8 characters.</p>
            </div>

            <div className="trial-form__field">
              <label htmlFor="confirm_password">Confirm your password</label>
              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </div>
          </div>

          <div className="trial-form__actions">
            <button type="button" className="btn btn--secondary btn--lg" onClick={() => goToStep(0)}>
              Back
            </button>
            <button type="button" className="btn btn--primary btn--lg" onClick={continueFromOwnerStep}>
              Continue
            </button>
          </div>
        </section>

      <section className="trial-form__section" hidden={currentStep !== 2} aria-hidden={currentStep !== 2}>
          <div className="trial-form__grid">
            <div className="trial-form__field trial-form__field--wide">
              <label>Which services should we start with?</label>
              <div id="services" className="trial-form__service-options" role="group" aria-label="Service options">
                {serviceOptions.map((service) => {
                  const checked = selectedServices.includes(service.title);
                  return (
                    <button
                      key={service.slug}
                      type="button"
                      className={`trial-form__service-option${checked ? ' trial-form__service-option--active' : ''}`}
                      onClick={() => handleServiceChange(service.title, !checked)}
                      aria-pressed={checked}
                    >
                      <span className="trial-form__service-check" aria-hidden="true">
                        {checked ? '✓' : ''}
                      </span>
                      <span>{service.title}</span>
                    </button>
                  );
                })}
              </div>
              <p className="trial-form__hint">You can change these later.</p>
            </div>

            {serviceOptions
              .filter((service) => selectedServices.includes(service.title))
              .map((service) => (
                <div key={service.slug} className="trial-form__field">
                  <label htmlFor={`service_image__${service.slug}`}>Want an image for {service.title}?</label>
                  <input
                    id={`service_image__${service.slug}`}
                    name={`service_image__${service.slug}`}
                    type="file"
                    accept="image/*"
                    onChange={(event) => handleServiceImageChange(service.slug, event)}
                  />
                  <p className="trial-form__hint">Optional.</p>
                  {servicePreviewUrls[service.slug] ? (
                    <div className="trial-form__upload-preview">
                      <AppImage role="card" src={servicePreviewUrls[service.slug]} alt={`${service.title} preview`} width={640} height={420} />
                    </div>
                  ) : null}
                </div>
              ))}
          </div>

          <div className="trial-form__actions">
            <button type="button" className="btn btn--secondary btn--lg" onClick={() => goToStep(1)}>
              Back
            </button>
            <PendingSubmitButton
              idleLabel="Create Your Site"
              pendingLabel="Building your trial..."
              className="trial-form__submit btn btn--primary btn--lg"
            />
          </div>
        </section>

      {serviceOptions.map((service) => {
        const checked = selectedServices.includes(service.title);
        return (
          <input
            key={`selected-${service.slug}`}
            type="checkbox"
            name={`service_selection__${service.slug}`}
            value={service.title}
            checked={checked}
            onChange={() => undefined}
            hidden
            readOnly
          />
        );
      })}

      {clientError ? <p className="trial-form__error">{clientError}</p> : null}
      {state.error ? <p className="trial-form__error">{state.error}</p> : null}
    </form>
  );
}
