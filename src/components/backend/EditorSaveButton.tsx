'use client';

import Button from '@/components/shared/Button';

interface EditorSaveButtonProps {
  isDirty: boolean;
  isSaving: boolean;
  label?: string;
  pendingLabel?: string;
  disabled?: boolean;
}

export default function EditorSaveButton({
  isDirty,
  isSaving,
  label = 'Save',
  pendingLabel = 'Saving...',
  disabled = false,
}: EditorSaveButtonProps) {
  return (
    <Button
      type="submit"
      variant={isDirty ? 'btn--primary' : 'btn--secondary'}
      disabled={disabled}
    >
      {isSaving ? pendingLabel : label}
    </Button>
  );
}
