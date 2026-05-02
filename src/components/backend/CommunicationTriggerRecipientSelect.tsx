'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { saveAutomationRuleFieldAction } from '@/lib/actions';

interface CommunicationTriggerRecipientSelectProps {
  ruleId: string;
  values: string[];
  triggerEvent: string;
}

const DEFAULT_RECIPIENTS_BY_TRIGGER: Record<string, { token: string; label: string }> = {
  inquiry_response: { token: 'contact', label: 'Contact' },
  review_request: { token: 'contact', label: 'Contact' },
  new_estimate: { token: 'contact', label: 'Contact' },
  new_invoice: { token: 'contact', label: 'Contact' },
};

function getDefaultRecipientConfig(triggerEvent: string) {
  return DEFAULT_RECIPIENTS_BY_TRIGGER[triggerEvent] ?? null;
}

function getRecipientLabel(value: string, triggerEvent: string) {
  const defaultRecipient = getDefaultRecipientConfig(triggerEvent);
  if (defaultRecipient && value === defaultRecipient.token) return defaultRecipient.label;
  return value;
}

function getEmptyRecipientLabel(triggerEvent: string) {
  const defaultRecipient = getDefaultRecipientConfig(triggerEvent);
  return defaultRecipient?.label ?? 'Add recipients';
}

export default function CommunicationTriggerRecipientSelect({
  ruleId,
  values,
  triggerEvent,
}: CommunicationTriggerRecipientSelectProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [draftRecipients, setDraftRecipients] = useState(values);
  const [draftEntry, setDraftEntry] = useState('');
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        rootRef.current &&
        !rootRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const defaultRecipient = useMemo(() => getDefaultRecipientConfig(triggerEvent), [triggerEvent]);
  const effectiveValues = useMemo(() => {
    if (values.length > 0) return values;
    return defaultRecipient ? [defaultRecipient.token] : [];
  }, [defaultRecipient, values]);

  useEffect(() => {
    if (!isOpen) {
      setDraftRecipients(effectiveValues);
      setDraftEntry('');
    }
  }, [effectiveValues, isOpen]);

  useEffect(() => {
    const shell = rootRef.current?.closest('.shell');
    setPortalTarget((shell as HTMLElement | null) ?? document.body);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function updateMenuPosition() {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const preferredWidth = Math.max(rect.width, 260);
      const maxWidth = Math.min(preferredWidth, viewportWidth - 16);
      const left = Math.min(rect.left, viewportWidth - maxWidth - 8);

      setMenuStyle({
        top: rect.bottom + 8,
        left: Math.max(8, left),
        width: maxWidth,
      });
    }

    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [isOpen]);

  const summaryLabel = useMemo(() => {
    if (effectiveValues.length === 0) return getEmptyRecipientLabel(triggerEvent);
    if (effectiveValues.length === 1) return getRecipientLabel(effectiveValues[0], triggerEvent);
    return `${getRecipientLabel(effectiveValues[0], triggerEvent)} +${effectiveValues.length - 1}`;
  }, [effectiveValues, triggerEvent]);

  function save(nextValues: string[]) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set('id', ruleId);
      formData.set('recipient_targets', JSON.stringify(nextValues));
      await saveAutomationRuleFieldAction(formData);
      router.refresh();
    });
  }

  function addDraftRecipient() {
    const normalizedEntry = draftEntry.trim();
    if (!normalizedEntry) return;

    setDraftRecipients((current) =>
      current.includes(normalizedEntry) ? current : [...current, normalizedEntry],
    );
    setDraftEntry('');
  }

  return (
    <div className="communication-recipient-picker" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="communication-recipient-picker__trigger"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        disabled={isPending}
        title={
          effectiveValues.length > 0
            ? effectiveValues.map((value) => getRecipientLabel(value, triggerEvent)).join(', ')
            : getEmptyRecipientLabel(triggerEvent)
        }
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="communication-recipient-picker__summary">{summaryLabel}</span>
        <span className="communication-recipient-picker__caret" aria-hidden="true">
          v
        </span>
      </button>

      {isOpen && menuStyle && portalTarget
        ? createPortal(
            <div
              ref={menuRef}
              className="communication-recipient-picker__menu communication-recipient-picker__menu--editor"
              role="dialog"
              aria-label="Edit recipients"
              style={{
                position: 'fixed',
                top: `${menuStyle.top}px`,
                left: `${menuStyle.left}px`,
                width: `${menuStyle.width}px`,
              }}
            >
              <div className="communication-recipient-picker__editor">
                <div className="communication-recipient-picker__entry-row">
                  <input
                    type="email"
                    className="communication-recipient-picker__input"
                    value={draftEntry}
                    onChange={(event) => setDraftEntry(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addDraftRecipient();
                      }
                    }}
                    placeholder="name@example.com"
                    disabled={isPending}
                  />
                  <button
                    type="button"
                    className="communication-recipient-picker__action-btn communication-recipient-picker__action-btn--secondary"
                    disabled={isPending || !draftEntry.trim()}
                    onClick={addDraftRecipient}
                  >
                    Add
                  </button>
                </div>

                <div className="communication-recipient-picker__list">
                  {draftRecipients.length === 0 ? (
                    <div className="communication-recipient-picker__empty">
                      {getEmptyRecipientLabel(triggerEvent)}
                    </div>
                  ) : (
                    draftRecipients.map((recipient) => (
                      <div key={recipient} className="communication-recipient-picker__item">
                        <span className="communication-recipient-picker__item-label">
                          {getRecipientLabel(recipient, triggerEvent)}
                        </span>
                        {defaultRecipient && recipient === defaultRecipient.token ? (
                          <span className="communication-recipient-picker__item-badge">Default</span>
                        ) : (
                          <button
                            type="button"
                            className="communication-recipient-picker__remove"
                            aria-label={`Remove ${recipient}`}
                            onClick={() =>
                              setDraftRecipients((current) =>
                                current.filter((value) => value !== recipient),
                              )
                            }
                          >
                            x
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="communication-recipient-picker__actions">
                <button
                  type="button"
                  className="communication-recipient-picker__action-btn communication-recipient-picker__action-btn--secondary"
                  disabled={isPending}
                  onClick={() => {
                    setDraftRecipients(effectiveValues);
                    setDraftEntry('');
                    setIsOpen(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="communication-recipient-picker__action-btn communication-recipient-picker__action-btn--primary"
                  disabled={isPending}
                  onClick={() => {
                    save(draftRecipients);
                    setIsOpen(false);
                  }}
                >
                  {isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>,
            portalTarget,
          )
        : null}
    </div>
  );
}
