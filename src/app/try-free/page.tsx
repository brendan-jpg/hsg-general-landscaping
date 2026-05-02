import FreeTrialOnboardingForm from '@/components/forms/FreeTrialOnboardingForm';

export const metadata = {
  title: 'Try Free',
  description: 'Create a trial home service website.',
};

export default function TryFreePage() {
  return (
    <main className="auth-page trial-page">
      <section className="auth-card trial-card" aria-label="Free trial onboarding">
        <div className="trial-card__hero">
          <div className="trial-card__hero-copy">
            <span className="trial-card__eyebrow">Free Trial</span>
            <h1 className="trial-card__title">Let&apos;s build your site</h1>
          </div>
        </div>

        <FreeTrialOnboardingForm />
      </section>
    </main>
  );
}
