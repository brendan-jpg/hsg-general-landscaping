import type { ReactNode } from 'react';

interface PageSectionProps {
  heading?: string;
  accent?: string;
  lede?: ReactNode;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
  id?: string;
  headingAs?: 'h1' | 'h2';
}

export default function PageSection({
  heading,
  accent,
  lede,
  children,
  className,
  action,
  id,
  headingAs = 'h2',
}: PageSectionProps) {
  const trimmedHeading = (heading ?? '').trim();
  const trimmedAccent = (accent ?? '').trim();
  const showHeading = trimmedHeading.length > 0;
  const showHead = Boolean(trimmedAccent) || showHeading || Boolean(lede) || Boolean(action);
  const HeadingTag = headingAs;
  return (
    <section
      className={['content-section', className].filter(Boolean).join(' ')}
      aria-labelledby={showHeading && id ? id : undefined}
    >
      {showHead ? (
        <div className="content-section__head container">
          {showHeading ? <HeadingTag id={id}>{trimmedHeading}</HeadingTag> : null}
          {trimmedAccent ? <p className="content-section__accent">{trimmedAccent}</p> : null}
          {lede ? <div className="content-section__lede">{lede}</div> : null}
          {action ? <div className="content-section__action">{action}</div> : null}
        </div>
      ) : null}
      <div className="content-section__body container">{children}</div>
    </section>
  );
}

