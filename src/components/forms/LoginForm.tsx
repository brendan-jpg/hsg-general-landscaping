'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/shared/Button';
import { createClient } from '@/lib/supabase/client';
import { requestPasswordResetEmailAction } from '@/lib/actions';

interface LoginFormProps {
  redirectTo?: string;
  initialError?: string | null;
  initialEmail?: string;
}

export default function LoginForm({ redirectTo = '/dashboard', initialError = null, initialEmail = '' }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'sign_in' | 'forgot_password'>('sign_in');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [notice, setNotice] = useState<string | null>(null);
  const submitLabel = useMemo(
    () => (mode === 'forgot_password' ? (isSubmitting ? 'Sending reset link...' : 'Send reset link') : (isSubmitting ? 'Signing in...' : 'Sign in')),
    [isSubmitting, mode],
  );

  function toggleMode(nextMode: 'sign_in' | 'forgot_password') {
    setMode(nextMode);
    setError(null);
    setNotice(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    const supabase = createClient();

    if (mode === 'forgot_password') {
      try {
        await requestPasswordResetEmailAction(email);
      } catch (resetError) {
        setError(resetError instanceof Error ? resetError.message : 'Unable to send reset link.');
        setIsSubmitting(false);
        return;
      }

      setNotice('If that email exists, a password reset link has been sent.');
      setIsSubmitting(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setIsSubmitting(false);
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <form className="login-form" onSubmit={handleSubmit} noValidate>
      <div className="login-form__mode-row">
        <button
          type="button"
          className={`login-form__mode-toggle ${mode === 'sign_in' ? 'login-form__mode-toggle--active' : ''}`}
          onClick={() => toggleMode('sign_in')}
        >
          Sign in
        </button>
        <button
          type="button"
          className={`login-form__mode-toggle ${mode === 'forgot_password' ? 'login-form__mode-toggle--active' : ''}`}
          onClick={() => toggleMode('forgot_password')}
        >
          Forgot password?
        </button>
      </div>

      <div className="login-form__field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>

      {mode === 'sign_in' ? (
        <div className="login-form__field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
      ) : (
        <p className="login-form__hint">Enter your email and we&apos;ll send you a password reset link.</p>
      )}

      {error && <p className="login-form__error">{error}</p>}
      {notice && <p className="login-form__notice">{notice}</p>}

      <Button className="login-form__submit" type="submit" disabled={isSubmitting} variant="btn--primary">
        {submitLabel}
      </Button>
    </form>
  );
}
