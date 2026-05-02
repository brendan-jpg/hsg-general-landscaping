'use client';

import { FormEvent, useState } from 'react';
import EditorSaveButton from '@/components/backend/EditorSaveButton';
import useDirtyState from '@/components/backend/useDirtyState';
import { useRouter } from 'next/navigation';
import QuarterHourDateTimeField, {
  toQuarterHourDateTimeLocalValue,
} from '@/components/backend/QuarterHourDateTimeField';
import { deleteScheduleItem, saveScheduleItem } from '@/lib/actions';
import { formatDateTime } from '@/lib/utils';
import type { Tables } from '@/lib/types/database';

type ScheduleItem = Tables<'schedule_items'>;
type Job = Tables<'jobs'>;

interface ScheduleItemEditorFormProps {
  item: ScheduleItem | null;
  teamMembers: Array<{
    team_member_id: string;
    profile_id: string | null;
    first_name: string | null;
    last_name: string | null;
    title: string | null;
    login_status: string;
    employment_status: string;
  }>;
  jobs: Array<Pick<Job, 'id' | 'title' | 'scheduled_start' | 'status'>>;
  initialStartsAt?: string | null;
  initialEndsAt?: string | null;
}

function formatJobOption(job: Pick<Job, 'title' | 'scheduled_start' | 'status'>) {
  const when = job.scheduled_start ? new Date(job.scheduled_start) : null;
  const whenLabel =
    when && !Number.isNaN(when.getTime()) ? ` - ${formatDateTime(when)}` : '';
  return `${job.title} (${job.status.replace(/_/g, ' ')})${whenLabel}`;
}

function formatTeamMemberOption(member: { first_name: string | null; last_name: string | null }) {
  return [member.first_name, member.last_name].filter(Boolean).join(' ').trim() || 'Unnamed Team Member';
}

export default function ScheduleItemEditorForm({
  item,
  teamMembers,
  jobs,
  initialStartsAt,
  initialEndsAt,
}: ScheduleItemEditorFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(item?.title ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [startsAt, setStartsAt] = useState(
    toQuarterHourDateTimeLocalValue(item?.starts_at ?? initialStartsAt ?? null)
  );
  const [endsAt, setEndsAt] = useState(toQuarterHourDateTimeLocalValue(item?.ends_at ?? initialEndsAt ?? null));
  const [location, setLocation] = useState(item?.location ?? '');
  const [assignedTo, setAssignedTo] = useState(
    (item as ScheduleItem & { assigned_team_member_id?: string | null })?.assigned_team_member_id ?? ''
  );
  const [relatedJobId, setRelatedJobId] = useState(item?.related_job_id ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDirty = useDirtyState({
    title,
    description,
    startsAt,
    endsAt,
    location,
    assignedTo,
    relatedJobId,
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const formData = new FormData();
      if (item?.id) formData.set('id', item.id);
      formData.set('title', title);
      formData.set('description', description);
      formData.set('starts_at', startsAt);
      formData.set('ends_at', endsAt);
      formData.set('location', location);
      formData.set('assigned_team_member_id', assignedTo);
      formData.set('related_job_id', relatedJobId);

      await saveScheduleItem(formData);
      router.push('/dashboard/schedule');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save schedule item');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!item?.id) return;
    if (!window.confirm('Delete this schedule item? This cannot be undone.')) return;

    setError(null);
    setIsDeleting(true);
    try {
      await deleteScheduleItem(item.id);
      router.push('/dashboard/schedule');
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete schedule item');
      setIsDeleting(false);
    }
  }

  return (
    <form className="editor" onSubmit={handleSubmit}>
      <div className="editor__main">
        <input
          className="editor__title-input"
          type="text"
          placeholder="Schedule item title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
        />
        <div className="editor__field-group">
          <label>Description</label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={8}
          />
        </div>
      </div>
      <aside className="editor__sidebar">
        <div className="editor__field-group">
          <label>Start</label>
          <QuarterHourDateTimeField
            value={startsAt}
            onChange={setStartsAt}
            required
            dateAriaLabel="Schedule start date"
            timeAriaLabel="Schedule start time"
          />
        </div>
        <div className="editor__field-group">
          <label>End</label>
          <QuarterHourDateTimeField
            value={endsAt}
            onChange={setEndsAt}
            dateAriaLabel="Schedule end date"
            timeAriaLabel="Schedule end time"
          />
        </div>
        <div className="editor__field-group">
          <label>Assigned Team Member</label>
          <select value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>
            <option value="">Unassigned</option>
            {teamMembers.map((member) => (
              <option key={member.team_member_id} value={member.team_member_id}>
                {formatTeamMemberOption(member)}
                {member.title ? ` (${member.title})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="editor__field-group">
          <label>Related Job (Optional)</label>
          <select value={relatedJobId} onChange={(event) => setRelatedJobId(event.target.value)}>
            <option value="">None</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {formatJobOption(job)}
              </option>
            ))}
          </select>
        </div>
        <div className="editor__field-group">
          <label>Location</label>
          <input
            type="text"
            placeholder="Office / address / note"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="editor__field-group">
          <EditorSaveButton isDirty={isDirty} isSaving={isSaving} disabled={isSaving || isDeleting} />
          {item?.id && (
            <button className="btn" type="button" onClick={handleDelete} disabled={isSaving || isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </aside>
    </form>
  );
}
