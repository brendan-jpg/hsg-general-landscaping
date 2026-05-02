import Link from 'next/link';
import { getActiveSystemPageHrefs } from '@/lib/content/queries';
import { getBusiness } from '@/lib/utils/business';

export default async function FrontendNotFound() {
  const [business, systemPageHrefs] = await Promise.all([
    getBusiness(),
    getActiveSystemPageHrefs(),
  ]);
  const hasBusiness = Boolean(business);
  const homeHref = '/';
  const servicesHref = systemPageHrefs.services || '/services';
  const contactHref = systemPageHrefs.contact || '/contact';

  return (
    <main
      className="page page--not-found"
      style={{
        minHeight: 'min(78vh, 860px)',
        display: 'grid',
        placeItems: 'center',
        padding: 'clamp(1.25rem, 4vw, 3rem) 1rem',
        background: hasBusiness
          ? 'transparent'
          : 'radial-gradient(circle at top, rgba(37, 99, 235, 0.12) 0%, transparent 34%), linear-gradient(180deg, #f8fbff 0%, #ffffff 40%)',
      }}
    >
      <section
        style={{
          width: 'min(100%, 880px)',
          borderRadius: '28px',
          border: '1px solid rgba(148, 163, 184, 0.22)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%)',
          boxShadow: '0 24px 64px rgba(15, 23, 42, 0.08)',
          padding: 'clamp(1.4rem, 4vw, 3rem)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gap: 'clamp(1.25rem, 3vw, 2rem)',
            alignItems: 'start',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 'fit-content',
              padding: '0.45rem 0.75rem',
              borderRadius: '999px',
              background: 'rgba(37, 99, 235, 0.08)',
              color: '#2563eb',
              fontSize: '0.8rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {hasBusiness ? '404' : 'Domain Setup'}
          </div>

          <div style={{ display: 'grid', gap: '0.85rem' }}>
            <h1
              style={{
                margin: 0,
                fontSize: 'clamp(2rem, 6vw, 4.5rem)',
                lineHeight: 0.95,
                letterSpacing: '-0.04em',
              }}
            >
              {hasBusiness ? 'Page not found.' : 'This site is not configured yet.'}
            </h1>
            <p
              style={{
                margin: 0,
                maxWidth: '52rem',
                color: '#5b6780',
                fontSize: 'clamp(1rem, 2vw, 1.2rem)',
                lineHeight: 1.7,
              }}
            >
              {hasBusiness
                ? `The page you were looking for doesn’t exist on ${business?.name ?? 'this site'} or may have been moved.`
                : 'This domain is not currently mapped to an active business in the platform. If you are the site owner, add this domain under Dashboard Settings > Business > Domains.'}
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.9rem',
            }}
          >
            <div
              style={{
                borderRadius: '20px',
                padding: '1rem 1.1rem',
                background: 'rgba(255,255,255,0.84)',
                border: '1px solid rgba(148, 163, 184, 0.18)',
              }}
            >
              <strong style={{ display: 'block', marginBottom: '0.35rem' }}>
                {hasBusiness ? 'Try the homepage' : 'Need dashboard access?'}
              </strong>
              <span style={{ color: '#64748b', lineHeight: 1.6 }}>
                {hasBusiness
                  ? 'Start from the main navigation and continue browsing from there.'
                  : 'Use the login screen if you’re managing this tenant from the dashboard.'}
              </span>
            </div>
            <div
              style={{
                borderRadius: '20px',
                padding: '1rem 1.1rem',
                background: 'rgba(255,255,255,0.84)',
                border: '1px solid rgba(148, 163, 184, 0.18)',
              }}
            >
              <strong style={{ display: 'block', marginBottom: '0.35rem' }}>
                {hasBusiness ? 'Looking for a service?' : 'Need to map this domain?'}
              </strong>
              <span style={{ color: '#64748b', lineHeight: 1.6 }}>
                {hasBusiness
                  ? 'Check the services page or reach out directly and we’ll point you in the right direction.'
                  : 'Add the domain to the tenant and mark the primary/canonical entry in platform settings.'}
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <Link href={hasBusiness ? homeHref : '/login'} className="btn btn--primary">
              {hasBusiness ? 'Go Home' : 'Go To Login'}
            </Link>
            <Link href={hasBusiness ? servicesHref : '/'} className="btn btn--secondary">
              {hasBusiness ? 'View Services' : 'Retry'}
            </Link>
            {hasBusiness ? (
              <Link href={contactHref} className="btn">
                Contact Us
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
