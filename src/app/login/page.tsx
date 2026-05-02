import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import LoginForm from '@/components/forms/LoginForm';
import AppImage from '@/components/shared/AppImage';
import { getBusiness, getResolvedBusinessDomain } from '@/lib/utils/business';

export const metadata = {
  title: 'Login',
};

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    email?: string;
    next?: string;
  }>;
};

function getLoginErrorMessage(error: string | undefined) {
  if (error === 'domain_mismatch') {
    return 'This account can only sign in from its assigned site domain.';
  }
  return null;
}

function normalizeHost(value: string | null | undefined) {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/:\d+$/, '')
    .replace(/\/+$/, '');
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = await createClient();
  const requestHeaders = await headers();
  const requestHost = normalizeHost(requestHeaders.get('x-forwarded-host') || requestHeaders.get('host'));
  const [business, resolvedBusinessDomain] = await Promise.all([
    getBusiness(),
    getResolvedBusinessDomain(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const params = (searchParams ? await searchParams : {}) ?? {};
  const errorMessage = getLoginErrorMessage(typeof params.error === 'string' ? params.error : undefined);
  const initialEmail = typeof params.email === 'string' ? params.email.trim() : '';
  const redirectTo =
    typeof params.next === 'string' && params.next.startsWith('/')
      ? params.next
      : '/dashboard';
  const shouldShowTenantLogo =
    Boolean(business?.logo_url) &&
    Boolean(requestHost) &&
    requestHost !== 'localhost' &&
    requestHost !== '127.0.0.1' &&
    requestHost === normalizeHost(resolvedBusinessDomain);

  if (user) {
    redirect('/dashboard');
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-label="Login form">
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
          <span className="auth-card__eyebrow">Dashboard Access</span>
          <h1 className="auth-card__title">Sign in</h1>
        </div>

        <LoginForm initialError={errorMessage} initialEmail={initialEmail} redirectTo={redirectTo} />
      </section>
    </main>
  );
}
