'use client';

import { FormEvent, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import EditorSaveButton from '@/components/backend/EditorSaveButton';
import useDirtyState from '@/components/backend/useDirtyState';
import { deleteEmailTemplateAction, saveEmailTemplateAction } from '@/lib/actions';
import type { Tables } from '@/lib/types/database';

type EmailTemplate = Tables<'email_templates'>;

interface EmailTemplateEditorFormProps {
  template: EmailTemplate | null;
}

const TEMPLATE_VARIABLES = [
  { tag: '{{contact_name}}', label: 'Contact name', sample: 'Jordan Smith' },
  { tag: '{{contact_first_name}}', label: 'Contact first name', sample: 'Jordan' },
  { tag: '{{contact_last_name}}', label: 'Contact last name', sample: 'Smith' },
  { tag: '{{business_name}}', label: 'Business name', sample: 'Acme Landscaping' },
  { tag: '{{form_type}}', label: 'Form type', sample: 'Quote request' },
  { tag: '{{contact_address}}', label: 'Contact address', sample: '123 Garden Lane' },
  { tag: '{{contact_email}}', label: 'Contact email', sample: 'jordan@example.com' },
  { tag: '{{contact_phone}}', label: 'Contact phone', sample: '(555) 123-4567' },
  { tag: '{{contact_message}}', label: 'Contact message', sample: 'Looking for a patio refresh this spring.' },
  { tag: '{{contact_files}}', label: 'Contact files', sample: 'Design brief: https://example.com/file.pdf' },
  { tag: '{{submitted_at}}', label: 'Submitted date', sample: 'March 30, 2026 at 9:15 AM' },
  { tag: '{{review_link}}', label: 'Review link', sample: 'https://google.com/review' },
  { tag: '{{job_title}}', label: 'Job title', sample: 'Backyard renovation' },
  { tag: '{{estimate_number}}', label: 'Estimate number', sample: 'EST-1042' },
  { tag: '{{estimate_version}}', label: 'Estimate version', sample: '2' },
  { tag: '{{approve_link}}', label: 'Approval link', sample: 'https://example.com/approve/abc123' },
  { tag: '{{approve_button}}', label: 'Approval button', sample: '[Approval button]' },
  { tag: '{{invoice_number}}', label: 'Invoice number', sample: 'INV-2208' },
  { tag: '{{total}}', label: 'Total', sample: '$2,450.00' },
  { tag: '{{due_date}}', label: 'Due date', sample: 'April 12, 2026' },
] as const;

const SAMPLE_VALUES = Object.fromEntries(TEMPLATE_VARIABLES.map((variable) => [variable.tag, variable.sample]));

function stripHtmlToText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildHtmlFromMessage(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  return trimmed
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

function applyPreviewValues(value: string) {
  let next = value;
  for (const [tag, sample] of Object.entries(SAMPLE_VALUES)) {
    next = next.split(tag).join(sample);
  }
  return next;
}

export default function EmailTemplateEditorForm({
  template,
}: EmailTemplateEditorFormProps) {
  const router = useRouter();
  const initialMessage = template?.body_text?.trim() || stripHtmlToText(template?.body_html ?? '');

  const [name, setName] = useState(template?.name ?? '');
  const [subject, setSubject] = useState(template?.subject ?? '');
  const [message, setMessage] = useState(initialMessage);
  const [rawHtml, setRawHtml] = useState(template?.body_html ?? buildHtmlFromMessage(initialMessage));
  const [rawText, setRawText] = useState(template?.body_text ?? initialMessage);
  const [insertTarget, setInsertTarget] = useState<'subject' | 'message'>('message');
  const [useAdvancedEditor, setUseAdvancedEditor] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subjectRef = useRef<HTMLInputElement | null>(null);
  const messageRef = useRef<HTMLTextAreaElement | null>(null);
  const bodyHtmlRef = useRef<HTMLTextAreaElement | null>(null);
  const bodyTextRef = useRef<HTMLTextAreaElement | null>(null);

  const isDirty = useDirtyState({
    name,
    subject,
    message,
    rawHtml,
    rawText,
    useAdvancedEditor,
  });

  const previewSubject = useMemo(
    () => applyPreviewValues(subject || 'Your subject line preview will appear here.'),
    [subject],
  );
  const previewMessage = useMemo(
    () => applyPreviewValues(useAdvancedEditor ? (rawText || message) : message || 'Write your message to preview it here.'),
    [message, rawText, useAdvancedEditor],
  );
  const previewHtml = useMemo(() => buildHtmlFromMessage(previewMessage), [previewMessage]);

  function insertIntoField(options: {
    tag: string;
    element: HTMLInputElement | HTMLTextAreaElement | null;
    value: string;
    setValue: (next: string) => void;
  }) {
    const { tag, element, value, setValue } = options;
    if (!element) {
      setValue(value ? `${value} ${tag}` : tag);
      return;
    }

    const start = element.selectionStart ?? value.length;
    const end = element.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${tag}${value.slice(end)}`;
    setValue(next);

    requestAnimationFrame(() => {
      element.focus();
      const cursor = start + tag.length;
      element.setSelectionRange(cursor, cursor);
    });
  }

  function handleInsertTag(tag: string) {
    if (insertTarget === 'subject') {
      insertIntoField({ tag, element: subjectRef.current, value: subject, setValue: setSubject });
      return;
    }

    if (useAdvancedEditor) {
      insertIntoField({ tag, element: bodyTextRef.current, value: rawText, setValue: setRawText });
      return;
    }

    insertIntoField({ tag, element: messageRef.current, value: message, setValue: setMessage });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const formData = new FormData();
      const resolvedBodyText = useAdvancedEditor ? rawText.trim() : message.trim();
      const resolvedBodyHtml = useAdvancedEditor
        ? (rawHtml.trim() || buildHtmlFromMessage(rawText))
        : buildHtmlFromMessage(message);

      if (template?.id) formData.set('id', template.id);
      formData.set('name', name);
      formData.set('subject', subject);
      formData.set('body_html', resolvedBodyHtml);
      formData.set('body_text', resolvedBodyText);

      await saveEmailTemplateAction(formData);
      router.push('/dashboard/automations');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save template');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!template?.id) return;
    if (!window.confirm('Delete this template? This cannot be undone.')) return;

    setError(null);
    setIsDeleting(true);
    try {
      await deleteEmailTemplateAction(template.id);
      router.push('/dashboard/automations');
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete template');
      setIsDeleting(false);
    }
  }

  return (
    <form className="editor email-template-editor" onSubmit={handleSubmit}>
      <div className="editor__main">
        <section className="email-template-editor__hero">
          <div className="email-template-editor__hero-copy">
            <p className="email-template-editor__eyebrow">Email Template</p>
            <input
              className="editor__title-input email-template-editor__title"
              type="text"
              placeholder="Template name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <div className="email-template-editor__hero-meta" aria-hidden="true">
            <span
              className={`email-template-editor__hero-chip ${
                (template?.is_active ?? true) ? 'is-active' : ''
              }`}
            >
              {(template?.is_active ?? true) ? 'Active' : 'Inactive'}
            </span>
          </div>
        </section>

        <section className="email-template-editor__card">
          <div className="email-template-editor__card-head">
            <h3>Subject</h3>
          </div>
          <input
            ref={subjectRef}
            className="email-template-editor__subject-input"
            type="text"
            placeholder="Example: Your estimate from {{business_name}}"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            required
          />
        </section>

        <section className="email-template-editor__card">
          <div className="email-template-editor__card-head">
            <h3>Message</h3>
          </div>
          <textarea
            ref={messageRef}
            className="email-template-editor__subject-input email-template-editor__message-input"
            placeholder={'Hi {{contact_first_name}},\n\nThanks for reaching out to {{business_name}}. We received your request and will follow up shortly.'}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={12}
            disabled={useAdvancedEditor}
          />
        </section>

        <section className="email-template-editor__card">
          <div className="email-template-editor__card-head">
            <h3>Insert Details</h3>
          </div>
          <div className="email-template-editor__insert-targets" role="tablist" aria-label="Insert target">
            <button
              type="button"
              className={`email-template-editor__insert-target${insertTarget === 'subject' ? ' is-active' : ''}`}
              onClick={() => setInsertTarget('subject')}
            >
              Insert into subject
            </button>
            <button
              type="button"
              className={`email-template-editor__insert-target${insertTarget === 'message' ? ' is-active' : ''}`}
              onClick={() => setInsertTarget('message')}
            >
              Insert into message
            </button>
          </div>
          <div className="email-template-editor__variable-grid">
            {TEMPLATE_VARIABLES.map((variable) => (
              <button
                key={variable.tag}
                type="button"
                className="email-template-editor__variable-card"
                onClick={() => handleInsertTag(variable.tag)}
              >
                <strong>{variable.label}</strong>
              </button>
            ))}
          </div>
        </section>

        <section className="email-template-editor__card">
          <label className="email-template-editor__advanced-toggle">
            <input
              type="checkbox"
              checked={useAdvancedEditor}
              onChange={(event) => setUseAdvancedEditor(event.target.checked)}
            />
            <span>Use advanced code editor</span>
          </label>
          {useAdvancedEditor ? (
            <div className="email-template-editor__advanced-grid">
              <div className="email-template-editor__composer">
                <label className="email-template-editor__field-label" htmlFor="email-template-html">
                  HTML version
                </label>
                <textarea
                  id="email-template-html"
                  ref={bodyHtmlRef}
                  className="editor__excerpt email-template-editor__composer-input"
                  placeholder="Optional advanced HTML email"
                  value={rawHtml}
                  onChange={(event) => setRawHtml(event.target.value)}
                  rows={10}
                />
              </div>
              <div className="email-template-editor__composer">
                <label className="email-template-editor__field-label" htmlFor="email-template-text">
                  Plain text version
                </label>
                <textarea
                  id="email-template-text"
                  ref={bodyTextRef}
                  className="editor__excerpt email-template-editor__composer-input"
                  placeholder="Optional text-only fallback"
                  value={rawText}
                  onChange={(event) => setRawText(event.target.value)}
                  rows={10}
                />
              </div>
            </div>
          ) : null}
        </section>
      </div>
      <aside className="editor__sidebar">
        {error && <p className="form-error">{error}</p>}
        <section className="email-template-editor__sidebar-card email-template-editor__preview-shell email-template-editor__preview-shell--compact">
          <div className="email-template-editor__preview-meta">
            <span>Live Preview</span>
            <strong>{previewSubject}</strong>
          </div>
          <div
            className="email-template-editor__preview-body"
            dangerouslySetInnerHTML={{ __html: previewHtml || '<p>Your message preview will appear here.</p>' }}
          />
        </section>
        <div className="editor__field-group email-template-editor__sidebar-card email-template-editor__sidebar-actions">
          <EditorSaveButton isDirty={isDirty} isSaving={isSaving} disabled={isSaving || isDeleting} />
          {template?.id && (
            <button className="btn" type="button" onClick={handleDelete} disabled={isSaving || isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </aside>
    </form>
  );
}
