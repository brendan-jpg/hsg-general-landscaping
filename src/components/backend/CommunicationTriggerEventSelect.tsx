'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { saveAutomationRuleFieldAction } from '@/lib/actions';

interface TriggerOption {
  value: string;
  label: string;
}

interface CommunicationTriggerEventSelectProps {
  ruleId: string;
  value: string;
  options: TriggerOption[];
}

export default function CommunicationTriggerEventSelect({
  ruleId,
  value,
  options,
}: CommunicationTriggerEventSelectProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <select
      className="communication-trigger-select"
      value={value}
      disabled={isPending}
      aria-label="Trigger event"
      onChange={(event) => {
        const nextValue = event.target.value;
        startTransition(async () => {
          const formData = new FormData();
          formData.set('id', ruleId);
          formData.set('trigger_event', nextValue);
          await saveAutomationRuleFieldAction(formData);
          router.refresh();
        });
      }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
