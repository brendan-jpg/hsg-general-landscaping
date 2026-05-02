'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { saveAutomationRuleFieldAction } from '@/lib/actions';

interface TemplateOption {
  value: string;
  label: string;
}

interface CommunicationTriggerTemplateSelectProps {
  ruleId: string;
  value: string;
  options: TemplateOption[];
}

export default function CommunicationTriggerTemplateSelect({
  ruleId,
  value,
  options,
}: CommunicationTriggerTemplateSelectProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <select
      className="communication-trigger-select"
      value={value}
      disabled={isPending}
      aria-label="Template"
      onChange={(event) => {
        const nextValue = event.target.value;
        startTransition(async () => {
          const formData = new FormData();
          formData.set('id', ruleId);
          formData.set('template_id', nextValue);
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
