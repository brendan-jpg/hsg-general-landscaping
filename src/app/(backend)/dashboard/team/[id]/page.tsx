import { notFound } from 'next/navigation';
import ModuleShell from '@/components/backend/shell/ModuleShell';
import TeamEditorForm from '@/components/backend/TeamEditorForm';
import { getDashboardTeamMemberById } from '@/lib/content/queries';
import { getDashboardSettingsData } from '@/lib/dashboard/queries';
import { getDashboardMedia } from '@/lib/media/queries';
import { getDashboardTeamMemberJobHistory } from '@/lib/operations/queries';

interface Props {
  params: Promise<{ id: string }>;
}

function formatCurrency(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatHours(value: number | null) {
  if (value === null || value === undefined) return '—';
  return `${Number(value).toFixed(2)}h`;
}

function formatDateTime(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
}

function prettyLabel(value: string | null | undefined) {
  if (!value) return '—';
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default async function TeamEditorPage({ params }: Props) {
  const { id } = await params;
  const isNew = id === 'new';

  const [member, mediaItems, settingsData, workHistory] = await Promise.all([
    isNew ? Promise.resolve(null) : getDashboardTeamMemberById(id),
    getDashboardMedia({ imagesOnly: true }),
    getDashboardSettingsData(),
    isNew ? Promise.resolve([]) : getDashboardTeamMemberJobHistory(id),
  ]);
  if (!isNew && !member) notFound();
  const teamTitleOptions = Array.isArray(settingsData.business?.settings)
    ? []
    : ((settingsData.business?.settings as Record<string, unknown> | null)?.team_title_types ?? []);
  const normalizedTitleOptions = Array.isArray(teamTitleOptions)
    ? teamTitleOptions
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  const employment = member?.employment ?? null;
  const rateValue =
    employment?.pay_type === 'salary'
      ? employment.salary_amount ?? null
      : employment?.hourly_rate ?? null;
  const totalHours = workHistory.reduce((sum, row) => sum + (row.hours_worked ?? 0), 0);
  const totalEarnings =
    employment?.pay_type === 'hourly' || employment?.pay_type === 'contract'
      ? workHistory.reduce((sum, row) => sum + ((row.hours_worked ?? 0) * (employment.hourly_rate ?? 0)), 0)
      : null;
  const workHistoryMetaItems = [
    { key: 'jobs', label: `${workHistory.length} Jobs` },
    { key: 'hours', label: formatHours(totalHours) },
    { key: 'pay-type', label: prettyLabel(employment?.pay_type ?? null) },
    {
      key: 'rate',
      label: `${employment?.pay_type === 'salary' ? 'Salary' : 'Rate'}: ${formatCurrency(rateValue)}`,
    },
    ...(totalEarnings !== null ? [{ key: 'tracked-pay', label: `Tracked Pay: ${formatCurrency(totalEarnings)}` }] : []),
  ];

  return (
    <ModuleShell title={isNew ? 'New Team Member' : 'Edit Team Member'}>
      <TeamEditorForm
        member={member}
        mediaItems={mediaItems}
        titleOptions={normalizedTitleOptions}
        mainFooter={
          !isNew && member ? (
            <section className="team-work-history">
              <div className="team-work-history__head">
                <h2>Work History</h2>
                <div className="team-work-history__meta">
                  {workHistoryMetaItems.map((item) => (
                    <span key={item.key}>{item.label}</span>
                  ))}
                </div>
              </div>
              {workHistory.length ? (
                <div className="team-work-history__table-wrap">
                  <table className="team-work-history__table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Job</th>
                        <th>Status</th>
                        <th>Hours</th>
                        <th>Pay</th>
                      </tr>
                    </thead>
                    <tbody>
                      {workHistory.map((row, index) => {
                        const earnings =
                          employment?.pay_type === 'hourly' || employment?.pay_type === 'contract'
                            ? (row.hours_worked ?? 0) * (employment.hourly_rate ?? 0)
                            : null;
                        return (
                          <tr key={`${row.id}-${row.job_id}-${index}`}>
                            <td>{formatDateTime(row.jobs?.scheduled_start ?? row.jobs?.created_at ?? null)}</td>
                            <td>{row.jobs?.title || 'Untitled Job'}</td>
                            <td>{prettyLabel(row.jobs?.status ?? null)}</td>
                            <td>{formatHours(row.hours_worked)}</td>
                            <td>{earnings === null ? '—' : formatCurrency(earnings)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="team-work-history__empty">No job history yet for this team member.</p>
              )}
            </section>
          ) : null
        }
      />
    </ModuleShell>
  );
}
