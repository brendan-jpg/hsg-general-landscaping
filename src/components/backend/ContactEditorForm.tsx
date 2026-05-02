'use client';

import Link from 'next/link';
import { FormEvent, ReactNode, useState } from 'react';
import EditorSaveButton from '@/components/backend/EditorSaveButton';
import JourneyTimeline from '@/components/backend/JourneyTimeline';
import StatusBadge from '@/components/shared/StatusBadge';
import useDirtyState from '@/components/backend/useDirtyState';
import { useRouter } from 'next/navigation';
import { deleteContact, saveContact, saveContactActivityEntries, toggleContactActivityPinned } from '@/lib/actions';
import { getContactListPath } from '@/lib/contacts/routing';
import type { Tables } from '@/lib/types/database';
import { US_STATE_OPTIONS } from '@/lib/usStates';
import { formatPhone } from '@/lib/utils';

type Contact = Tables<'contacts'>;
type ActivityLog = Tables<'activity_log'>;

type DraftContactActivity = {
  id: string;
  type: 'called' | 'texted' | 'emailed' | 'noted';
  note: string;
  pinned: boolean;
  occurredAt: string;
};

type ActivityLogWithAuthor = ActivityLog & {
  profiles?: { first_name?: string | null; last_name?: string | null } | null;
};

interface ContactEditorFormProps {
  contact: Contact | null;
  activityLog?: ActivityLogWithAuthor[];
  initialStatus?: Contact['status'];
  bottomContent?: ReactNode;
  latestEstimateId?: string | null;
}

const CONTACT_JOURNEY_STEPS: Array<{ status: Extract<Contact['status'], 'lead' | 'prospect' | 'customer'>; label: string }> = [
  { status: 'lead', label: 'Lead' },
  { status: 'prospect', label: 'Prospect' },
  { status: 'customer', label: 'Customer' },
];

const LEAD_STAGE_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'attempted', label: 'Attempted' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'unqualified', label: 'Unqualified' },
  { value: 'lost', label: 'Lost' },
  { value: 'spam', label: 'Spam' },
] as const;

function getJourneyIndex(status: Contact['status']) {
  if (status === 'customer') return 2;
  if (status === 'prospect') return 1;
  return 0;
}

function normalizeLeadStage(value: string | null | undefined) {
  const normalized = (value ?? '').trim().toLowerCase();
  if (!normalized) return 'new';
  if (normalized === 'qualified' || normalized === 'hot') return 'contacted';
  if (normalized === 'nurture') return 'attempted';
  if (['new', 'attempted', 'contacted', 'unqualified', 'lost', 'spam'].includes(normalized)) {
    return normalized;
  }
  return 'new';
}

function activityTypeLabel(type: DraftContactActivity['type']) {
  if (type === 'noted') return 'Note';
  if (type === 'called') return 'Call';
  if (type === 'emailed') return 'Email';
  return 'Text';
}

function getCurrentDateTimeLocalValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function formatActivityAuthor(entry: ActivityLogWithAuthor) {
  const name = [entry.profiles?.first_name, entry.profiles?.last_name].filter(Boolean).join(' ').trim();
  return name || 'Unknown user';
}

function formatActivityWhen(metadata: Record<string, unknown>, createdAt: string) {
  const occurredAt = typeof metadata.occurred_at === 'string' && metadata.occurred_at.trim() ? metadata.occurred_at : createdAt;
  return new Date(occurredAt).toLocaleString([], {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 17v5" />
      <path d="M8 3h8l-1 5 3 4v2H6v-2l3-4-1-5z" />
    </svg>
  );
}

function ActivityTypeIcon({ type }: { type: DraftContactActivity['type'] }) {
  if (type === 'noted') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 5h16v12H8l-4 4V5z" />
      </svg>
    );
  }

  if (type === 'called') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    );
  }

  if (type === 'emailed') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 7l9 6 9-6" />
      </svg>
    );
  }

  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function ContactEditorForm({
  contact,
  activityLog = [],
  initialStatus = 'lead',
  bottomContent,
  latestEstimateId = null,
}: ContactEditorFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(contact?.first_name ?? '');
  const [lastName, setLastName] = useState(contact?.last_name ?? '');
  const [email, setEmail] = useState(contact?.email ?? '');
  const [phone, setPhone] = useState(contact?.phone ? formatPhone(contact.phone) : '');
  const [status, setStatus] = useState<Contact['status']>(contact?.status ?? initialStatus);
  const [source, setSource] = useState<Contact['source']>(contact?.source ?? 'manual');
  const [quality, setQuality] = useState(normalizeLeadStage(contact?.quality));
  const [addressLine1, setAddressLine1] = useState(contact?.address_line1 ?? '');
  const [addressLine2, setAddressLine2] = useState(contact?.address_line2 ?? '');
  const [city, setCity] = useState(contact?.city ?? '');
  const [state, setState] = useState((contact?.state ?? '').toUpperCase());
  const [zip, setZip] = useState(contact?.zip ?? '');
  const [notes, setNotes] = useState(contact?.notes ?? '');
  const [draftActivities, setDraftActivities] = useState<DraftContactActivity[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingActivity, setIsSavingActivity] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);
  const savedStatus = contact?.status ?? initialStatus;
  const uiStatus = contact?.id ? savedStatus : status;
  const isLeadStatus = uiStatus === 'lead';
  const isDirty = useDirtyState({
    firstName,
    lastName,
    email,
    phone,
    status,
    source,
    quality,
    addressLine1,
    addressLine2,
    city,
    state,
    zip,
    notes,
  });
  const activityEntriesToSave = draftActivities
    .map((entry) => ({
      type: entry.type,
      note: entry.note.trim(),
      pinned: entry.type === 'noted' && entry.pinned,
      occurredAt: entry.type === 'noted' ? null : entry.occurredAt,
    }))
    .filter((entry) => entry.note);
  const canSaveActivity = Boolean(contact?.id && activityEntriesToSave.length > 0 && !isSavingActivity);
  const hasDraftContent = activityEntriesToSave.length > 0;

  function addDraftActivity(type: DraftContactActivity['type']) {
    setDraftActivities((current) => [
      ...current,
      { id: crypto.randomUUID(), type, note: '', pinned: type === 'noted', occurredAt: getCurrentDateTimeLocalValue() },
    ]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const formData = new FormData();
      if (contact?.id) formData.set('id', contact.id);
      formData.set('first_name', firstName);
      formData.set('last_name', lastName);
      formData.set('email', email);
      formData.set('phone', phone);
      formData.set('status', status);
      formData.set('source', source);
      formData.set('quality', quality);
      formData.set('address_line1', addressLine1);
      formData.set('address_line2', addressLine2);
      formData.set('city', city);
      formData.set('state', state);
      formData.set('zip', zip);
      formData.set('notes', notes);

      await saveContact(formData);
      router.push(getContactListPath(status));
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save contact');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveActivity() {
    if (!contact?.id) return;

    setActivityError(null);
    setIsSavingActivity(true);
    try {
      const formData = new FormData();
      formData.set('contact_id', contact.id);
      formData.set('contact_activity_entries', JSON.stringify(activityEntriesToSave));
      await saveContactActivityEntries(formData);
      setDraftActivities([]);
      router.refresh();
    } catch (submitError) {
      setActivityError(submitError instanceof Error ? submitError.message : 'Unable to save activity');
    } finally {
      setIsSavingActivity(false);
    }
  }

  async function handleDelete() {
    if (!contact?.id) return;
    if (!window.confirm('Delete this contact? This cannot be undone.')) return;

    setError(null);
    setIsDeleting(true);
    try {
      await deleteContact(contact.id);
      router.push(getContactListPath(contact.status));
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete contact');
      setIsDeleting(false);
    }
  }

  return (
    <form className="editor" onSubmit={handleSubmit}>
      <div className="editor__main">
        {contact?.id ? (
          <div className="contact-editor__topbar">
            <div className="contact-editor__topbar-main">
              <div className="contact-editor__topbar-controls">
                <div className="editor__field-group contact-editor__topbar-source">
                  <label>Source</label>
                  <select value={source} onChange={(event) => setSource(event.target.value as Contact['source'])}>
                    <option value="manual">Manual</option>
                    <option value="website_form">Website Form</option>
                    <option value="phone">Phone</option>
                    <option value="referral">Referral</option>
                    <option value="google">Google</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                {isLeadStatus ? (
                  <div className="editor__field-group contact-editor__topbar-stage">
                    <label>Stage</label>
                    <div className="contact-editor__stage-row" role="list" aria-label="Lead stage options">
                      {LEAD_STAGE_OPTIONS.map((option) => {
                        const isActive = quality === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            className={`contact-editor__stage-chip${isActive ? ' contact-editor__stage-chip--active' : ''}`}
                            onClick={() => setQuality(option.value)}
                            aria-pressed={isActive}
                          >
                            <StatusBadge status={option.value} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="contact-editor__topbar-timeline">
                <JourneyTimeline
                  ariaLabel="Contact journey"
                  currentIndex={getJourneyIndex(status)}
                  onStepClick={(stepKey) => setStatus(stepKey as Contact['status'])}
                  steps={CONTACT_JOURNEY_STEPS.map((step) => ({
                    key: step.status,
                    label: step.label,
                  }))}
                />
              </div>
            </div>

            <div className="contact-editor__topbar-actions">
              {uiStatus === 'lead' ? (
                <Link href={`/dashboard/estimates/new?contactId=${contact.id}`} className="btn btn--secondary">
                  New Estimate
                </Link>
              ) : null}

              {uiStatus === 'prospect' ? (
                latestEstimateId ? (
                  <Link href={`/dashboard/estimates/${latestEstimateId}`} className="btn btn--secondary">
                    Approve Estimate
                  </Link>
                ) : (
                  <button type="button" className="btn btn--secondary" disabled>
                    Approve Estimate
                  </button>
                )
              ) : null}

              {uiStatus === 'customer' ? (
                <>
                  <Link href={`/dashboard/jobs/new?contactId=${contact.id}`} className="btn btn--secondary">
                    New Job
                  </Link>
                  <Link href={`/dashboard/estimates/new?contactId=${contact.id}`} className="btn btn--secondary">
                    New Estimate
                  </Link>
                  <Link href={`/dashboard/invoices/new?contactId=${contact.id}`} className="btn btn--primary">
                    New Invoice
                  </Link>
                </>
              ) : null}
            </div>
          </div>
        ) : null}
        <section className="contact-activity-editor">
          <div className="contact-activity-editor__head">
            <h3>Notes &amp; Activity</h3>
            <div className="contact-activity-editor__actions">
              {hasDraftContent ? (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={handleSaveActivity}
                  disabled={!canSaveActivity}
                >
                  {isSavingActivity ? 'Saving Activity...' : 'Save Activity'}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => addDraftActivity('called')}
                  >
                    + Call
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => addDraftActivity('emailed')}
                  >
                    + Email
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary"
                    onClick={() => addDraftActivity('texted')}
                  >
                    + Text
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary contact-activity-editor__action-note"
                    onClick={() => addDraftActivity('noted')}
                  >
                    + Note
                  </button>
                </>
              )}
            </div>
          </div>

          {draftActivities.length > 0 && (
            <div className="contact-activity-editor__drafts">
              {draftActivities.map((entry) => (
                <div key={entry.id} className="contact-activity-editor__draft">
                  <div className="contact-activity-editor__draft-head">
                    <span className="contact-activity-editor__draft-type">{activityTypeLabel(entry.type)}</span>
                    {entry.type === 'noted' ? (
                      <button
                        type="button"
                        className={`contact-activity-editor__pin-btn${entry.pinned ? ' contact-activity-editor__pin-btn--active' : ''}`}
                        onClick={() =>
                          setDraftActivities((current) =>
                            current.map((item) => (item.id === entry.id ? { ...item, pinned: !item.pinned } : item)),
                          )
                        }
                        aria-label={entry.pinned ? 'Unpin note' : 'Pin note'}
                        title={entry.pinned ? 'Unpin note' : 'Pin note'}
                      >
                        <PinIcon />
                      </button>
                    ) : null}
                  </div>
                  <textarea
                    rows={3}
                    placeholder="What happened?"
                    value={entry.note}
                    onChange={(event) =>
                      setDraftActivities((current) =>
                        current.map((item) => (item.id === entry.id ? { ...item, note: event.target.value } : item)),
                      )
                    }
                  />
                  {entry.type !== 'noted' ? (
                    <div className="contact-activity-editor__draft-datetime">
                      <label>
                        <span>Date &amp; Time</span>
                        <input
                          type="datetime-local"
                          value={entry.occurredAt}
                          onChange={(event) =>
                            setDraftActivities((current) =>
                              current.map((item) => (item.id === entry.id ? { ...item, occurredAt: event.target.value } : item)),
                            )
                          }
                        />
                      </label>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setDraftActivities((current) => current.filter((item) => item.id !== entry.id))}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          {activityLog.length > 0 ? (
            <div className="contact-activity-editor__history">
              {activityLog.map((entry) => {
                const metadata =
                  entry.metadata && typeof entry.metadata === 'object' && !Array.isArray(entry.metadata)
                    ? (entry.metadata as Record<string, unknown>)
                    : {};
                const note = typeof metadata.note === 'string' ? metadata.note : '';
                const pinned = metadata.pinned === true;
                const actionType = entry.action.replace('contact_', '').replace(/_/g, ' ') as DraftContactActivity['type'];
                const actionLabel = actionType;
                const isNoteEntry = entry.action === 'contact_noted';
                return (
                  <article key={entry.id} className={`contact-activity-editor__entry${pinned ? ' contact-activity-editor__entry--pinned' : ''}`}>
                    <div className="contact-activity-editor__entry-meta">
                      <strong className="contact-activity-editor__entry-type">
                        <ActivityTypeIcon type={actionType} />
                        <span>{actionLabel.charAt(0).toUpperCase() + actionLabel.slice(1)}</span>
                      </strong>
                      <div className="contact-activity-editor__entry-meta-actions">
                        {isNoteEntry ? (
                          <button
                            type="button"
                            className={`contact-activity-editor__pin-btn${pinned ? ' contact-activity-editor__pin-btn--active' : ''}`}
                            onClick={async () => {
                              await toggleContactActivityPinned(entry.id, !pinned);
                              router.refresh();
                            }}
                            aria-label={pinned ? 'Unpin note' : 'Pin note'}
                            title={pinned ? 'Unpin note' : 'Pin note'}
                          >
                            <PinIcon />
                          </button>
                        ) : null}
                        <span>{formatActivityWhen(metadata, entry.created_at)}</span>
                        <span>by {formatActivityAuthor(entry)}</span>
                      </div>
                    </div>
                    <p>{note || 'No notes logged.'}</p>
                  </article>
                );
              })}
            </div>
          ) : draftActivities.length === 0 ? (
            <p className="contact-activity-editor__empty">No logged activity yet.</p>
          ) : null}
          {!contact?.id ? (
            <p className="contact-activity-editor__empty">Save the contact first before logging activity.</p>
          ) : null}
          {activityError ? <p className="form-error">{activityError}</p> : null}
        </section>
        {bottomContent}
      </div>

      <aside className="editor__sidebar">
        <div className="contact-editor__sidebar-grid">
          <div className="editor__field-group contact-editor__sidebar-field contact-editor__sidebar-field--half">
            <label>First Name</label>
            <input
              type="text"
              placeholder="First name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
          </div>
          <div className="editor__field-group contact-editor__sidebar-field contact-editor__sidebar-field--half">
            <label>Last Name</label>
            <input
              type="text"
              placeholder="Last name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
          </div>
          <div className="editor__field-group contact-editor__sidebar-field contact-editor__sidebar-field--full">
            <label>Email</label>
            <input
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="editor__field-group contact-editor__sidebar-field contact-editor__sidebar-field--full">
            <label>Phone</label>
            <input
              type="tel"
              placeholder="555-555-5555"
              value={phone}
              onChange={(event) => setPhone(formatPhone(event.target.value))}
            />
          </div>
        </div>
        <div className="editor__field-group">
          <label>Address</label>
          <input
            type="text"
            placeholder="Address line 1"
            value={addressLine1}
            onChange={(event) => setAddressLine1(event.target.value)}
          />
          <input
            type="text"
            placeholder="Address line 2"
            value={addressLine2}
            onChange={(event) => setAddressLine2(event.target.value)}
          />
          <input type="text" placeholder="City" value={city} onChange={(event) => setCity(event.target.value)} />
          <select value={state} onChange={(event) => setState(event.target.value)}>
            <option value="">State</option>
            {US_STATE_OPTIONS.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
          <input type="text" placeholder="Zip" value={zip} onChange={(event) => setZip(event.target.value)} />
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="editor__field-group">
          <EditorSaveButton isDirty={isDirty} isSaving={isSaving} disabled={isSaving || isDeleting} />
          {contact?.id && (
            <button className="btn" type="button" onClick={handleDelete} disabled={isSaving || isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </aside>
    </form>
  );
}
