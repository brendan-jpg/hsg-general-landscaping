'use client';

import { FormEvent, useMemo, useState } from 'react';
import EditorSaveButton from '@/components/backend/EditorSaveButton';
import JourneyTimeline from '@/components/backend/JourneyTimeline';
import { useRouter } from 'next/navigation';
import QuarterHourDateTimeField, {
  toQuarterHourDateTimeLocalValue,
} from '@/components/backend/QuarterHourDateTimeField';
import useDirtyState from '@/components/backend/useDirtyState';
import { deleteJob, saveJob } from '@/lib/actions';
import type { Tables } from '@/lib/types/database';
import { US_STATE_OPTIONS } from '@/lib/usStates';

type Job = Tables<'jobs'>;

interface JobEditorFormProps {
  job: Job | null;
  contacts: Array<{ id: string; first_name: string | null; last_name: string | null }>;
  teamMembers: Array<{
    team_member_id: string;
    profile_id: string | null;
    first_name: string | null;
    last_name: string | null;
    title: string | null;
    login_status: string;
    employment_status: string;
  }>;
  initialAssignments?: Array<{
    team_member_id: string;
    hours_worked: number | null;
  }>;
  initialContactId?: string;
}

function contactName(contact: { first_name: string | null; last_name: string | null }) {
  return [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || 'Unnamed Contact';
}

function teamMemberName(member: { first_name: string | null; last_name: string | null }) {
  return [member.first_name, member.last_name].filter(Boolean).join(' ').trim() || 'Unnamed Team Member';
}

function getJobJourneySteps(status: Job['status']) {
  return [
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'in_progress', label: 'In Progress' },
    { key: status === 'canceled' ? 'canceled' : 'completed', label: status === 'canceled' ? 'Canceled' : 'Complete' },
  ];
}

function getJobJourneyIndex(status: Job['status']) {
  if (status === 'in_progress') return 1;
  if (status === 'completed' || status === 'canceled') return 2;
  return 0;
}

export default function JobEditorForm({
  job,
  contacts,
  teamMembers,
  initialAssignments = [],
  initialContactId,
}: JobEditorFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(job?.title ?? '');
  const [contactId, setContactId] = useState(job?.contact_id ?? initialContactId ?? '');
  const [jobTeamAssignments, setJobTeamAssignments] = useState<Array<{ team_member_id: string; hours_worked: string }>>(() => {
    if (initialAssignments.length) {
      return initialAssignments.map((row) => ({
        team_member_id: row.team_member_id,
        hours_worked: row.hours_worked === null || row.hours_worked === undefined ? '' : String(row.hours_worked),
      }));
    }
    const fallbackAssigned = (job as Job & { assigned_team_member_id?: string | null })?.assigned_team_member_id ?? '';
    return fallbackAssigned ? [{ team_member_id: fallbackAssigned, hours_worked: '' }] : [];
  });
  const [status, setStatus] = useState<Job['status']>(job?.status ?? 'scheduled');
  const [priority, setPriority] = useState<Job['priority']>(job?.priority ?? 'normal');
  const [scheduledStart, setScheduledStart] = useState(
    toQuarterHourDateTimeLocalValue(job?.scheduled_start)
  );
  const [scheduledEnd, setScheduledEnd] = useState(
    toQuarterHourDateTimeLocalValue(job?.scheduled_end)
  );
  const [description, setDescription] = useState(job?.description ?? '');
  const [internalNotes, setInternalNotes] = useState(job?.internal_notes ?? '');
  const [addressLine1, setAddressLine1] = useState(job?.address_line1 ?? '');
  const [addressLine2, setAddressLine2] = useState(job?.address_line2 ?? '');
  const [city, setCity] = useState(job?.city ?? '');
  const [state, setState] = useState((job?.state ?? '').toUpperCase());
  const [zip, setZip] = useState(job?.zip ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const assignmentByTeamMemberId = useMemo(
    () => new Map(jobTeamAssignments.map((row) => [row.team_member_id, row])),
    [jobTeamAssignments]
  );
  const isDirty = useDirtyState({
    title,
    contactId,
    jobTeamAssignments,
    status,
    priority,
    scheduledStart,
    scheduledEnd,
    description,
    internalNotes,
    addressLine1,
    addressLine2,
    city,
    state,
    zip,
  });

  function toggleTeamMember(teamMemberId: string, checked: boolean) {
    setJobTeamAssignments((current) => {
      const exists = current.some((row) => row.team_member_id === teamMemberId);
      if (checked) {
        if (exists) return current;
        return [...current, { team_member_id: teamMemberId, hours_worked: '' }];
      }
      return current.filter((row) => row.team_member_id !== teamMemberId);
    });
  }

  function setTeamMemberHours(teamMemberId: string, nextHours: string) {
    setJobTeamAssignments((current) =>
      current.map((row) => (row.team_member_id === teamMemberId ? { ...row, hours_worked: nextHours } : row))
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const normalizedAssignments = jobTeamAssignments.map((row) => ({
        team_member_id: row.team_member_id,
        hours_worked: row.hours_worked.trim() === '' ? null : row.hours_worked.trim(),
      }));
      const formData = new FormData();
      if (job?.id) formData.set('id', job.id);
      formData.set('title', title);
      formData.set('contact_id', contactId);
      formData.set('assigned_team_member_id', normalizedAssignments[0]?.team_member_id ?? '');
      formData.set('job_team_assignments', JSON.stringify(normalizedAssignments));
      formData.set('status', status);
      formData.set('priority', priority);
      formData.set('scheduled_start', scheduledStart);
      formData.set('scheduled_end', scheduledEnd);
      formData.set('description', description);
      formData.set('internal_notes', internalNotes);
      formData.set('address_line1', addressLine1);
      formData.set('address_line2', addressLine2);
      formData.set('city', city);
      formData.set('state', state);
      formData.set('zip', zip);

      await saveJob(formData);
      router.push('/dashboard/jobs');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save job');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!job?.id) return;
    if (!window.confirm('Delete this job? This cannot be undone.')) return;

    setError(null);
    setIsDeleting(true);
    try {
      await deleteJob(job.id);
      router.push('/dashboard/jobs');
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete job');
      setIsDeleting(false);
    }
  }

  return (
    <form className="editor" onSubmit={handleSubmit}>
      <div className="editor__main">
        <JourneyTimeline
          ariaLabel="Job journey"
          currentIndex={getJobJourneyIndex(status)}
          steps={getJobJourneySteps(status)}
        />
        <input
          className="editor__title-input"
          type="text"
          placeholder="Job title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
        <div className="editor__field-group">
          <label>Description</label>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={6} />
        </div>
        <div className="editor__field-group">
          <label>Internal Notes</label>
          <textarea value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} rows={8} />
        </div>
        <div className="editor__field-group job-editor__team-section">
          <div className="job-editor__team-section-head">
            <span>Team Assignments</span>
            <span className="job-editor__team-count">{jobTeamAssignments.length} selected</span>
          </div>
          <div className="job-editor__team-list">
            {teamMembers.map((member) => {
              const assignedRow = assignmentByTeamMemberId.get(member.team_member_id);
              const isAssigned = Boolean(assignedRow);
              return (
                <div
                  key={member.team_member_id}
                  className={`job-editor__team-row${isAssigned ? ' job-editor__team-row--selected' : ''}`}
                >
                  <label className="job-editor__team-member">
                    <input
                      type="checkbox"
                      checked={isAssigned}
                      onChange={(event) => toggleTeamMember(member.team_member_id, event.target.checked)}
                    />
                    <span className="job-editor__team-member-copy">
                      <span>{teamMemberName(member)}</span>
                      {member.title && <small>{member.title}</small>}
                    </span>
                  </label>
                  <label className="job-editor__team-hours">
                    <span>Hours</span>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      inputMode="decimal"
                      value={assignedRow?.hours_worked ?? ''}
                      onChange={(event) => setTeamMemberHours(member.team_member_id, event.target.value)}
                      disabled={!isAssigned}
                      placeholder="0"
                    />
                  </label>
                </div>
              );
            })}
            {!teamMembers.length && <p className="job-editor__team-empty">No team members found.</p>}
          </div>
        </div>
      </div>
      <aside className="editor__sidebar">
        <div className="editor__field-group">
          <label>Contact</label>
          <select value={contactId} onChange={(event) => setContactId(event.target.value)} required>
            <option value="">Select contact</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contactName(contact)}
              </option>
            ))}
          </select>
        </div>
        <div className="editor__field-group">
          <label>Status</label>
          <select value={status} onChange={(event) => setStatus(event.target.value as Job['status'])}>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="canceled">Canceled</option>
          </select>
        </div>
        <div className="editor__field-group">
          <label>Priority</label>
          <select value={priority} onChange={(event) => setPriority(event.target.value as Job['priority'])}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div className="editor__field-group">
          <label>Scheduled Start</label>
          <QuarterHourDateTimeField
            value={scheduledStart}
            onChange={setScheduledStart}
            dateAriaLabel="Scheduled start date"
            timeAriaLabel="Scheduled start time"
          />
          <label>Scheduled End</label>
          <QuarterHourDateTimeField
            value={scheduledEnd}
            onChange={setScheduledEnd}
            dateAriaLabel="Scheduled end date"
            timeAriaLabel="Scheduled end time"
          />
        </div>
        <div className="editor__field-group">
          <label>Address</label>
          <input type="text" placeholder="Address line 1" value={addressLine1} onChange={(event) => setAddressLine1(event.target.value)} />
          <input type="text" placeholder="Address line 2" value={addressLine2} onChange={(event) => setAddressLine2(event.target.value)} />
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
          {job?.id && (
            <button className="btn" type="button" onClick={handleDelete} disabled={isSaving || isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </aside>
    </form>
  );
}
