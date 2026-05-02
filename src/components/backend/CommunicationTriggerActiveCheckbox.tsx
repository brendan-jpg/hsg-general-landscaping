'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { saveAutomationRuleFieldAction } from '@/lib/actions';

interface CommunicationTriggerActiveCheckboxProps {
  ruleId: string;
  isActive: boolean;
}

export default function CommunicationTriggerActiveCheckbox({
  ruleId,
  isActive,
}: CommunicationTriggerActiveCheckboxProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <input
      type="checkbox"
      checked={isActive}
      disabled={isPending}
      aria-label="Flow active"
      onChange={(event) => {
        const checked = event.target.checked;
        startTransition(async () => {
          const formData = new FormData();
          formData.set('id', ruleId);
          formData.set('is_active_present', '1');
          if (checked) formData.set('is_active', 'on');
          await saveAutomationRuleFieldAction(formData);
          router.refresh();
        });
      }}
    />
  );
}
