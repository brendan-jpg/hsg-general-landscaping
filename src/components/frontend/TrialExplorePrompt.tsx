'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

const STORAGE_KEY = 'hsg_trial_dashboard_url';

export default function TrialExplorePrompt() {
  const searchParams = useSearchParams();
  const [dashboardUrl, setDashboardUrl] = useState<string>('');

  useEffect(() => {
    const fromQuery = searchParams.get('dashboard')?.trim() || '';

    if (fromQuery) {
      window.sessionStorage.setItem(STORAGE_KEY, fromQuery);
      setDashboardUrl(fromQuery);
      return;
    }

    const stored = window.sessionStorage.getItem(STORAGE_KEY) || '';
    setDashboardUrl(stored);
  }, [searchParams]);

  const isVisible = useMemo(() => Boolean(dashboardUrl), [dashboardUrl]);

  if (!isVisible) return null;

  return (
    <aside
      aria-label="Continue to dashboard"
      style={{
        position: 'fixed',
        right: 'clamp(1rem, 3vw, 2rem)',
        bottom: 'clamp(1rem, 3vw, 2rem)',
        zIndex: 60,
        width: 'min(92vw, 360px)',
        display: 'grid',
        gap: '0.9rem',
        padding: '1rem 1.1rem',
        borderRadius: '22px',
        border: '1px solid rgba(15, 23, 42, 0.1)',
        background: 'rgba(255, 255, 255, 0.96)',
        boxShadow: '0 24px 48px rgba(15, 23, 42, 0.18)',
        backdropFilter: 'blur(14px)',
      }}
    >
      <div style={{ display: 'grid', gap: '0.35rem' }}>
        <strong style={{ fontSize: '1rem', color: '#0f172a' }}>Your site is live</strong>
        <p style={{ margin: 0, color: '#475569', fontSize: '0.95rem', lineHeight: 1.55 }}>
          Look around as much as you want. When you&apos;re ready, head into the dashboard to edit pages, media, and settings.
        </p>
      </div>
      <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
        <Link className="btn btn--primary" href={dashboardUrl}>
          Continue To Dashboard
        </Link>
      </div>
    </aside>
  );
}
