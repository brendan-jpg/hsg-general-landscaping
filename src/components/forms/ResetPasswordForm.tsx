'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Button from '@/components/shared/Button';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifyingInvite, setIsVerifyingInvite] = useState(false);
  const [isVerifyingRecovery, setIsVerifyingRecovery] = useState(false);
  const [isRecoveryReady, setIsRecoveryReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isInviteFlow = searchParams.get('invite') === '1';
  const nextUrl = searchParams.get('next')?.trim() || '';
  const tokenHash = searchParams.get('token_hash')?.trim() || '';
  const accessToken = searchParams.get('access_token')?.trim() || '';
  const refreshToken = searchParams.get('refresh_token')?.trim() || '';
  const invalidLinkMessage = isInviteFlow
    ? 'This invite link is invalid or has expired.'
    : 'This password reset link is invalid or has expired.';

  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;

    async function initializeRecovery() {
      if (tokenHash && !accessToken && !refreshToken) {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (sessionError) {
          setError(sessionError.message);
          return;
        }

        if (data.session) {
          setIsRecoveryReady(true);
          return;
        }

        setNotice(isInviteFlow ? 'Accept your invite to create your password.' : 'Continue to securely reset your password.');
        setError(null);
        return;
      }

      if (accessToken && refreshToken) {
        const { error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (!isMounted) return;

        if (setSessionError) {
          setError(setSessionError.message);
          return;
        }
      }

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!isMounted) return;

      if (sessionError) {
        setError(sessionError.message);
        return;
      }

      if (data.session) {
        setIsRecoveryReady(true);
        return;
      }

      setError(invalidLinkMessage);
    }

    void initializeRecovery();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (!isMounted) return;
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setIsRecoveryReady(true);
        setError(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [accessToken, invalidLinkMessage, isInviteFlow, refreshToken, tokenHash]);

  async function handleVerifyToken() {
    if (!tokenHash) {
      setError(invalidLinkMessage);
      return;
    }

    if (isInviteFlow) {
      setIsVerifyingInvite(true);
    } else {
      setIsVerifyingRecovery(true);
    }
    setError(null);
    setNotice(null);

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: isInviteFlow ? 'invite' : 'recovery',
    });

    if (verifyError) {
      setError(verifyError.message || invalidLinkMessage);
      setIsVerifyingInvite(false);
      setIsVerifyingRecovery(false);
      return;
    }

    setIsRecoveryReady(true);
    setNotice(isInviteFlow ? 'Invite accepted. Create your password below.' : 'Link confirmed. Choose your new password below.');
    setIsVerifyingInvite(false);
    setIsVerifyingRecovery(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isRecoveryReady) {
      setError(invalidLinkMessage);
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setIsSubmitting(false);
      return;
    }

    setNotice(isInviteFlow ? 'Invite accepted. Redirecting you to sign in...' : 'Password updated. Redirecting you to sign in...');
    await supabase.auth.signOut();
    if (nextUrl) {
      const isAbsolute = /^https?:\/\//i.test(nextUrl);
      if (isAbsolute) {
        window.location.assign(nextUrl);
        return;
      }
      router.push(nextUrl);
    } else {
      router.push('/login');
    }
    router.refresh();
  }

  return (
    <form className="login-form" onSubmit={handleSubmit} noValidate>
      {!isRecoveryReady && tokenHash && (
        <>
          {error && <p className="login-form__error">{error}</p>}
          {notice && <p className="login-form__notice">{notice}</p>}
          <Button
            className="login-form__submit"
            type="button"
            disabled={isVerifyingInvite || isVerifyingRecovery || !tokenHash}
            onClick={() => void handleVerifyToken()}
            variant="btn--primary"
          >
            {isInviteFlow
              ? (isVerifyingInvite ? 'Accepting invite...' : 'Accept invite')
              : (isVerifyingRecovery ? 'Verifying link...' : 'Continue')}
          </Button>
        </>
      )}

      {(!tokenHash || isRecoveryReady) && (
        <>
      <div className="login-form__field">
        <label htmlFor="new-password">New password</label>
        <input
          id="new-password"
          name="new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          minLength={8}
          disabled={!isRecoveryReady || isSubmitting}
        />
      </div>

      <div className="login-form__field">
        <label htmlFor="confirm-password">Confirm password</label>
        <input
          id="confirm-password"
          name="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
          minLength={8}
          disabled={!isRecoveryReady || isSubmitting}
        />
      </div>

      {error && <p className="login-form__error">{error}</p>}
      {notice && <p className="login-form__notice">{notice}</p>}

      <Button className="login-form__submit" type="submit" disabled={!isRecoveryReady || isSubmitting} variant="btn--primary">
        {isSubmitting ? (isInviteFlow ? 'Setting password...' : 'Updating password...') : (isInviteFlow ? 'Set password' : 'Update password')}
      </Button>
        </>
      )}
    </form>
  );
}
