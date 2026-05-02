'use client';

interface JourneyTimelineStep {
  key: string;
  label: string;
}

interface JourneyTimelineProps {
  steps: JourneyTimelineStep[];
  currentIndex: number;
  ariaLabel: string;
  onStepClick?: (stepKey: string) => void;
}

export default function JourneyTimeline({
  steps,
  currentIndex,
  ariaLabel,
  onStepClick,
}: JourneyTimelineProps) {
  return (
    <section className="contact-journey" aria-label={ariaLabel}>
      <div className="contact-journey__steps">
        {steps.map((step, index) => {
          const state =
            index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'upcoming';

          return (
            <span key={step.key} className="contact-journey__item">
              <button
                type="button"
                className={`contact-journey__step${onStepClick ? ' contact-journey__step--interactive' : ''} contact-journey__step--${state} contact-journey__step--${step.key}`}
                aria-current={state === 'current' ? 'step' : undefined}
                onClick={onStepClick ? () => onStepClick(step.key) : undefined}
                disabled={!onStepClick}
              >
                <span className="contact-journey__dot" aria-hidden="true" />
                <span className="contact-journey__label">{step.label}</span>
              </button>
              {index < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={`contact-journey__connector${index < currentIndex ? ' contact-journey__connector--active contact-journey__connector--' + step.key : ''}`}
                />
              ) : null}
            </span>
          );
        })}
      </div>
    </section>
  );
}
