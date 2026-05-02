import { headers } from 'next/headers';
import ResetPasswordForm from '@/components/forms/ResetPasswordForm';
import AppImage from '@/components/shared/AppImage';
import { getBusiness, getResolvedBusinessDomain } from '@/lib/utils/business';

export const metadata = {
  title: 'Reset Password',
};

interface ResetPasswordPageProps {
  searchParams?: Promise<{
    invite?: string;
  }>;
}

function normalizeHost(value: string | null | undefined) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/:\d+$/, '')
    .replace(/\/+$/, '');
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const query = (searchParams ? await searchParams : {}) ?? {};
  const isInviteFlow = query.invite === '1';
  const requestHeaders = await headers();
  const requestHost = normalizeHost(requestHeaders.get('x-forwarded-host') || requestHeaders.get('host'));
  const [business, resolvedBusinessDomain] = await Promise.all([
    getBusiness(),
    getResolvedBusinessDomain(),
  ]);
  const shouldShowTenantLogo =
    Boolean(business?.logo_url) &&
    Boolean(requestHost) &&
    requestHost !== 'localhost' &&
    requestHost !== '127.0.0.1' &&
    requestHost === normalizeHost(resolvedBusinessDomain);

  return (
    <main className="auth-page">
      <section className="auth-card" aria-label="Reset password form">
        <div className="auth-card__hero">
          {shouldShowTenantLogo && business?.logo_url ? (
            <div className="auth-card__brand">
              <AppImage
                role="logo"
                src={business.logo_url}
                alt={business.name ? `${business.name} logo` : 'Business logo'}
                className="auth-card__brand-logo"
                width={320}
                height={140}
              />
            </div>
          ) : null}
          <span className="auth-card__eyebrow">{isInviteFlow ? 'Account Setup' : 'Account Recovery'}</span>
          <h1 className="auth-card__title">{isInviteFlow ? 'Set your password' : 'Reset password'}</h1>
          {!isInviteFlow ? <p className="auth-card__subtitle">Choose a new password to finish recovering your account.</p> : null}
        </div>

        <ResetPasswordForm />
      </section>
    </main>
  );
}
