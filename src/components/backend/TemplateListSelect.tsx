'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/shared/Button';
import type { TemplateOption } from '@/lib/sections/templateOptions';

interface TemplateListSelectProps {
  ariaLabel: string;
  initialValue: string;
  options: TemplateOption[];
  onChangeAction: (nextValue: string) => Promise<unknown>;
}

export default function TemplateListSelect({
  ariaLabel,
  initialValue,
  options,
  onChangeAction,
}: TemplateListSelectProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [isPending, startTransition] = useTransition();
  const isDirty = value !== initialValue;

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  return (
    <div
      className={`list-template-select ${isPending ? 'list-template-select--pending' : ''}`}
      onClick={(event) => event.stopPropagation()}
    >
      <select
        aria-label={ariaLabel}
        value={value}
        disabled={isPending}
        onChange={(event) => {
          setValue(event.target.value);
        }}
      >
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
      <Button
        type="button"
        variant={isDirty ? 'btn--primary' : 'btn--secondary'}
        size="btn--sm"
        className="list-template-select__save"
        disabled={isPending || !isDirty}
        onClick={() => {
          if (!isDirty) return;
          startTransition(async () => {
            try {
              await onChangeAction(value);
              router.refresh();
            } catch {
              setValue(initialValue);
            }
          });
        }}
      >
        {isPending ? 'Saving...' : 'Save'}
      </Button>
    </div>
  );
}
