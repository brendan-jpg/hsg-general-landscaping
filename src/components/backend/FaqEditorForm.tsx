'use client';

import { FormEvent, useMemo, useState } from 'react';
import EditorSaveButton from '@/components/backend/EditorSaveButton';
import useDirtyState from '@/components/backend/useDirtyState';
import { useRouter } from 'next/navigation';
import { deleteFaq, saveFaq } from '@/lib/actions';
import type { Tables } from '@/lib/types/database';

type Faq = Tables<'faqs'>;

interface FaqEditorFormProps {
  faq: Faq | null;
  serviceOptions: Array<{ id: string; title: string }>;
  linkedServiceIds: string[];
}

export default function FaqEditorForm({ faq, serviceOptions, linkedServiceIds }: FaqEditorFormProps) {
  const router = useRouter();
  const [question, setQuestion] = useState(faq?.question ?? '');
  const [answer, setAnswer] = useState(faq?.answer ?? '');
  const [isGlobal, setIsGlobal] = useState(faq?.is_global ?? false);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(linkedServiceIds);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedServiceIdsSet = useMemo(() => new Set(selectedServiceIds), [selectedServiceIds]);
  const isDirty = useDirtyState({
    question,
    answer,
    isGlobal,
    selectedServiceIds,
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const formData = new FormData();
      if (faq?.id) formData.set('id', faq.id);
      formData.set('question', question);
      formData.set('answer', answer);
      if (isGlobal) formData.set('is_global', 'on');
      formData.set('linked_service_ids', JSON.stringify(selectedServiceIds));

      await saveFaq(formData);
      router.push('/dashboard/faqs');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save FAQ');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!faq?.id) return;
    if (!window.confirm('Delete this FAQ? This cannot be undone.')) return;

    setError(null);
    setIsDeleting(true);
    try {
      await deleteFaq(faq.id);
      router.push('/dashboard/faqs');
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete FAQ');
      setIsDeleting(false);
    }
  }

  return (
    <form className="editor" onSubmit={handleSubmit}>
      <div className="editor__main">
        <input
          className="editor__title-input"
          type="text"
          placeholder="Question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          required
        />
        <textarea
          className="editor__excerpt"
          placeholder="Answer"
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          rows={12}
          required
        />
      </div>

      <aside className="editor__sidebar">
        <div className="editor__field-group">
          <label>
            <input type="checkbox" checked={isGlobal} onChange={(event) => setIsGlobal(event.target.checked)} />{' '}
            FAQ - Featured
          </label>
        </div>
        <div className="editor__field-group">
          <label>Linked Services</label>
          {serviceOptions.length === 0 ? (
            <p>No services available yet.</p>
          ) : (
            serviceOptions.map((service) => (
              <label key={service.id}>
                <input
                  type="checkbox"
                  checked={selectedServiceIdsSet.has(service.id)}
                  onChange={(event) => {
                    setSelectedServiceIds((current) => {
                      if (event.target.checked) return [...current, service.id];
                      return current.filter((id) => id !== service.id);
                    });
                  }}
                />
                {service.title}
              </label>
            ))
          )}
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="editor__field-group">
          <EditorSaveButton isDirty={isDirty} isSaving={isSaving} disabled={isSaving || isDeleting} />
          {faq?.id && (
            <button className="btn" type="button" onClick={handleDelete} disabled={isSaving || isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </aside>
    </form>
  );
}
