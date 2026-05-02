'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createDefaultFormAutoResponseTemplatesAction } from '@/lib/actions';

export default function CreateFormAutoResponsesButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const result = await createDefaultFormAutoResponseTemplatesAction();
        setMessage(`Templates synced. Inserted: ${result.inserted}, Updated: ${result.updated}.`);
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : 'Unable to create templates');
      }
    });
  }

  return (
    <div>
      <button type="button" className="btn btn--primary" onClick={handleClick} disabled={isPending}>
        {isPending ? 'Creating...' : 'Create Form Auto-Responses'}
      </button>
      {message && <p style={{ marginTop: '0.5rem' }}>{message}</p>}
      {error && <p className="form-error" style={{ marginTop: '0.5rem' }}>{error}</p>}
    </div>
  );
}
