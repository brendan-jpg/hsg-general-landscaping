import Link from 'next/link';

interface UpcomingJobItem {
  id: string | null;
  title: string | null;
  customer_name: string | null;
  assigned_to_name: string | null;
  scheduled_start: string | null;
}

interface UpcomingJobsProps {
  jobs: UpcomingJobItem[];
}

function formatDate(value: string | null) {
  if (!value) return 'Unscheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unscheduled';
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

export default function UpcomingJobs({ jobs }: UpcomingJobsProps) {
  const hasItems = jobs.length > 0;

  return (
    <div className="upcoming-jobs">
      <h3 className="upcoming-jobs__title">Upcoming Jobs</h3>
      <ul className="upcoming-jobs__list">
        {!hasItems && <li className="upcoming-jobs__item">No upcoming jobs.</li>}
        {jobs.map((job, index) => (
          <li key={job.id ?? `${job.title ?? 'job'}-${index}`} className="upcoming-jobs__item">
            {job.id ? (
              <Link href={`/dashboard/jobs/${job.id}`} className="upcoming-jobs__link">
                <span className="upcoming-jobs__name">{job.title ?? 'Untitled job'}</span>
                <span className="upcoming-jobs__customer">{job.customer_name ?? 'No customer'}</span>
                <span className="upcoming-jobs__time">{formatDate(job.scheduled_start)}</span>
                <span className="upcoming-jobs__assigned">{job.assigned_to_name ?? 'Unassigned'}</span>
              </Link>
            ) : (
              <div className="upcoming-jobs__link">
                <span className="upcoming-jobs__name">{job.title ?? 'Untitled job'}</span>
                <span className="upcoming-jobs__customer">{job.customer_name ?? 'No customer'}</span>
                <span className="upcoming-jobs__time">{formatDate(job.scheduled_start)}</span>
                <span className="upcoming-jobs__assigned">{job.assigned_to_name ?? 'Unassigned'}</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
