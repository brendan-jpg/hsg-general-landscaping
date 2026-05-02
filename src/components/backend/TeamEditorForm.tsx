'use client';

import { FormEvent, useMemo, useState } from 'react';
import EditorSaveButton from '@/components/backend/EditorSaveButton';
import { useRouter } from 'next/navigation';
import MediaPickerField from '@/components/backend/MediaPickerField';
import useDirtyState from '@/components/backend/useDirtyState';
import { saveTeamMember } from '@/lib/actions';
import type { Tables } from '@/lib/types/database';
import { formatPhone } from '@/lib/utils';

type TeamMember = Tables<'team_members'>;
type TeamMemberEmployment = Tables<'team_member_employment'>;
type Media = Tables<'media'>;
type TeamMemberRecord = TeamMember & { employment?: TeamMemberEmployment | null };

interface TeamEditorFormProps {
  member: TeamMemberRecord | null;
  mediaItems: Media[];
  titleOptions?: string[];
  mainFooter?: React.ReactNode;
}

function toNumberValue(value: number | null | undefined) {
  return value === null || value === undefined ? '' : String(value);
}

export default function TeamEditorForm({
  member,
  mediaItems,
  titleOptions = [],
  mainFooter,
}: TeamEditorFormProps) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(member?.first_name ?? '');
  const [lastName, setLastName] = useState(member?.last_name ?? '');
  const [title, setTitle] = useState(member?.title ?? '');
  const [photoUrl, setPhotoUrl] = useState(member?.photo_url ?? '');
  const [bio, setBio] = useState(member?.bio ?? '');
  const [phone, setPhone] = useState(member?.employment?.phone ? formatPhone(member.employment.phone) : '');
  const [websitePublished, setWebsitePublished] = useState(member?.website_published ?? true);
  const [loginEmail, setLoginEmail] = useState(member?.employment?.login_email ?? '');
  const [loginStatus, setLoginStatus] = useState(member?.employment?.login_status ?? 'not_created');
  const [appRole, setAppRole] = useState<'admin' | 'employee'>(
    member?.employment?.app_role === 'admin' ? 'admin' : 'employee'
  );
  const [employmentStatus, setEmploymentStatus] = useState(
    member?.employment?.employment_status ?? 'full_time'
  );
  const [payType, setPayType] = useState(member?.employment?.pay_type ?? 'hourly');
  const [hourlyRate, setHourlyRate] = useState(toNumberValue(member?.employment?.hourly_rate));
  const [salaryAmount, setSalaryAmount] = useState(toNumberValue(member?.employment?.salary_amount));
  const [startDate, setStartDate] = useState(member?.employment?.start_date ?? '');
  const [endDate, setEndDate] = useState(member?.employment?.end_date ?? '');
  const [internalNotes, setInternalNotes] = useState(member?.employment?.internal_notes ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolvedTitleOptions = useMemo(
    () =>
      Array.from(new Set([...(title ? [title] : []), ...titleOptions.map((option) => option.trim()).filter(Boolean)])),
    [title, titleOptions],
  );
  const isDirty = useDirtyState({
    firstName,
    lastName,
    title,
    photoUrl,
    bio,
    phone,
    websitePublished,
    loginEmail,
    loginStatus,
    appRole,
    employmentStatus,
    payType,
    hourlyRate,
    salaryAmount,
    startDate,
    endDate,
    internalNotes,
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const formData = new FormData();
      if (member?.id) formData.set('id', member.id);
      formData.set('first_name', firstName);
      formData.set('last_name', lastName);
      formData.set('title', title);
      formData.set('photo_url', photoUrl);
      formData.set('bio', bio);
      formData.set('phone', phone);
      formData.set('website_published', websitePublished ? 'on' : 'off');
      formData.set('login_email', loginEmail);
      formData.set('login_status', loginStatus);
      formData.set('app_role', appRole);
      formData.set('employment_status', employmentStatus);
      formData.set('pay_type', payType);
      formData.set('hourly_rate', hourlyRate);
      formData.set('salary_amount', salaryAmount);
      formData.set('start_date', startDate);
      formData.set('end_date', endDate);
      formData.set('internal_notes', internalNotes);

      await saveTeamMember(formData);
      router.push('/dashboard/team');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save team member');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="editor team-editor" onSubmit={handleSubmit}>
      <div className="editor__main">
        <div className="team-editor__name-row">
          <div className="editor__field-group">
            <label>First Name</label>
            <input
              className="editor__title-input"
              type="text"
              placeholder="First name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
            />
          </div>
          <div className="editor__field-group">
            <label>Last Name</label>
            <input
              className="editor__title-input"
              type="text"
              placeholder="Last name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
            />
          </div>
        </div>
        <div className="team-editor__name-row">
          <div className="editor__field-group">
            <label>Email</label>
            <input
              type="email"
              value={loginEmail}
              onChange={(event) => setLoginEmail(event.target.value)}
              placeholder="employee@company.com"
            />
          </div>
          <div className="editor__field-group">
            <label>Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(formatPhone(event.target.value))}
              placeholder="555-123-4567"
            />
          </div>
        </div>
        <div className="editor__field-group">
          <label>Title</label>
          <select
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          >
            <option value="">None</option>
            {resolvedTitleOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="editor__field-group">
          <label>Bio</label>
          <textarea
            className="editor__excerpt"
            placeholder="Short bio..."
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            rows={4}
          />
        </div>
        <div className="editor__field-group team-editor__notes-field">
          <label>Internal Notes</label>
          <textarea
            rows={5}
            value={internalNotes}
            onChange={(event) => setInternalNotes(event.target.value)}
            placeholder="Internal notes (not shown publicly)"
          />
        </div>
        {mainFooter}
      </div>
      <aside className="editor__sidebar">
        <MediaPickerField
          className="team-editor__photo-field"
          label="Photo"
          value={photoUrl}
          onChange={setPhotoUrl}
          items={mediaItems}
          showChangeAction={false}
        />
        <div className="editor__field-group">
          <label>
            <input
              type="checkbox"
              checked={websitePublished}
              onChange={(event) => setWebsitePublished(event.target.checked)}
            />{" "}
            Website / Publish
          </label>
        </div>
        <div className="team-editor__sidebar-row">
          <div className="editor__field-group">
            <label>App Role</label>
            <select value={appRole} onChange={(event) => setAppRole(event.target.value as 'admin' | 'employee')}>
              <option value="employee">Employee</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="editor__field-group">
            <label>Employment</label>
            <select value={employmentStatus} onChange={(event) => setEmploymentStatus(event.target.value)}>
              <option value="full_time">Full Time</option>
              <option value="part_time">Part Time</option>
              <option value="contractor">Contractor</option>
            </select>
          </div>
        </div>
        {member?.id && (
          <div className="editor__field-group">
            <label>Login Status</label>
            <select value={loginStatus} onChange={(event) => setLoginStatus(event.target.value)}>
              <option value="not_created">Not Created</option>
              <option value="invited">Invited</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </div>
        )}
        <div className="team-editor__sidebar-row">
          <div className="editor__field-group">
            <label>Pay Type</label>
            <select value={payType} onChange={(event) => setPayType(event.target.value)}>
              <option value="hourly">Hourly</option>
              <option value="salary">Salary</option>
              <option value="contract">Contract</option>
            </select>
          </div>
          {(payType === 'hourly' || payType === 'contract') ? (
            <div className="editor__field-group">
              <label>{payType === 'contract' ? 'Contract Rate' : 'Hourly Rate'}</label>
              <input
                type="number"
                step="0.01"
                value={hourlyRate}
                onChange={(event) => setHourlyRate(event.target.value)}
              />
            </div>
          ) : (
            <div className="editor__field-group">
              <label>Salary Amount</label>
              <input
                type="number"
                step="0.01"
                value={salaryAmount}
                onChange={(event) => setSalaryAmount(event.target.value)}
              />
            </div>
          )}
        </div>
        <div className="team-editor__sidebar-row">
          <div className="editor__field-group">
            <label>Start Date</label>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </div>
          <div className="editor__field-group">
            <label>End Date</label>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </div>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="editor__field-group">
          <EditorSaveButton isDirty={isDirty} isSaving={isSaving} disabled={isSaving} />
        </div>
      </aside>
    </form>
  );
}
