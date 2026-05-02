import PageSection from './PageSection';

export interface ProcessStep {
  heading: string;
  lede?: string;
}

interface ProcessSectionProps {
  heading?: string;
  accent?: string;
  lede?: string;
  steps?: ProcessStep[];
  className?: string;
  headingAs?: 'h1' | 'h2';
}

export default function ProcessSection({
  heading = 'Process',
  accent,
  lede,
  steps,
  className,
  headingAs = 'h2',
}: ProcessSectionProps) {
  if (!steps || steps.length === 0) return null;

  return (
    <PageSection heading={heading} accent={accent} lede={lede} className={className} headingAs={headingAs}>
      <ol className="process-steps" aria-label={heading}>
        {steps.map((step, index) => (
          <li key={`${step.heading}-${index}`} className="process-steps__item">
            <span className="process-steps__index" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="process-steps__copy">
              <h3>{step.heading}</h3>
              {step.lede ? <p>{step.lede}</p> : null}
            </div>
          </li>
        ))}
      </ol>
    </PageSection>
  );
}
