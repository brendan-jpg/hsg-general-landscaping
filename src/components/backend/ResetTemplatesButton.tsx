'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { resetAllAreaTemplates, resetAllServiceTemplates } from '@/lib/actions';

interface ResetTemplatesButtonProps {
  target: 'services' | 'areas';
}

export default function ResetTemplatesButton({ target }: ResetTemplatesButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState<'idle' | 'success' | 'error'>('idle');

  const noun = target === 'services' ? 'services' : 'Areas';

  useEffect(() => {
    if (state === 'idle') return;
    const timer = window.setTimeout(() => {
      setState('idle');
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [state]);

  function handleClick() {
    if (!window.confirm(`Reset templates for all ${noun}? This overwrites existing page section content.`)) {
      return;
    }
    setState('idle');
    startTransition(async () => {
      try {
        await (target === 'services' ? resetAllServiceTemplates() : resetAllAreaTemplates());
        setState('success');
        router.refresh();
      } catch (submitError) {
        console.error(`Unable to reset ${noun}:`, submitError);
        setState('error');
      }
    });
  }

  const label = isPending
    ? 'Resetting...'
    : state === 'success'
      ? '\u2713 Reset'
      : state === 'error'
        ? 'Try Again'
        : 'Reset Templates';

  return (
    <button type="button" className="btn" onClick={handleClick} disabled={isPending}>
      {label}
    </button>
  );
}
