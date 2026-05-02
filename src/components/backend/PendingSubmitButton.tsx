'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import PlusIcon from '@/components/shared/icons/PlusIcon';

interface PendingSubmitButtonProps {
  idleLabel: string;
  pendingLabel?: string;
  className?: string;
}

function serializeFormValue(value: FormDataEntryValue) {
  if (typeof value === 'string') return value;
  return `${value.name}:${value.size}:${value.lastModified}`;
}

function createFormSnapshot(form: HTMLFormElement | null) {
  if (!form) return '';
  return JSON.stringify(
    Array.from(new FormData(form).entries()).map(([key, value]) => [key, serializeFormValue(value)]),
  );
}

export default function PendingSubmitButton({
  idleLabel,
  pendingLabel = 'Saving...',
  className = 'btn',
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const form = buttonRef.current?.closest('form');
    if (!form) return;

    const initialSnapshot = createFormSnapshot(form);
    const updateDirtyState = () => {
      setIsDirty(createFormSnapshot(form) !== initialSnapshot);
    };

    updateDirtyState();
    form.addEventListener('input', updateDirtyState);
    form.addEventListener('change', updateDirtyState);
    form.addEventListener('reset', updateDirtyState);

    return () => {
      form.removeEventListener('input', updateDirtyState);
      form.removeEventListener('change', updateDirtyState);
      form.removeEventListener('reset', updateDirtyState);
    };
  }, []);

  const hasExplicitVariant = /\bbtn--(?:primary|secondary|ghost|success|danger)\b/.test(className);
  const isCreateAction = /^(add|new)\b/i.test(idleLabel.trim());
  const resolvedClassName = [
    className,
    hasExplicitVariant ? null : isDirty ? 'btn--primary' : 'btn--secondary',
    isCreateAction ? 'btn--create' : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button ref={buttonRef} type="submit" className={resolvedClassName} disabled={pending}>
      {!pending && isCreateAction ? (
        <>
          <span className="btn__icon" aria-hidden="true">
            <PlusIcon />
          </span>
          <span className="btn__label">{idleLabel}</span>
        </>
      ) : (
        pending ? pendingLabel : idleLabel
      )}
    </button>
  );
}
