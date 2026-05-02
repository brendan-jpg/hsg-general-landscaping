'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import ScheduleDaySidebarForm from '@/components/backend/ScheduleDaySidebarForm';

interface TeamMemberOption {
  team_member_id: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
}

interface JobOption {
  id: string;
  title: string | null;
  scheduled_start: string | null;
  status: string;
}

interface ScheduleDayEntry {
  id: string;
  type: 'Job' | 'Custom';
  title: string;
  startsAt: string;
  time: string;
  href: string;
  meta: string;
}

interface ScheduleDayItem {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  assigned_team_member_id: string | null;
  related_job_id: string | null;
}

interface ScheduleDaySlot {
  hour: number;
  label: string;
  at: string;
  entries: ScheduleDayEntry[];
}

interface ScheduleDayViewProps {
  day: string;
  dayLabel: string;
  month: string;
  totalCount: number;
  slots: ScheduleDaySlot[];
  teamMembers: TeamMemberOption[];
  jobs: JobOption[];
  items: ScheduleDayItem[];
  initialAt: string;
  initialItemId?: string | null;
}

function addHourToSlotStamp(slotStamp: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(slotStamp)) return slotStamp;
  const [datePart, timePart] = slotStamp.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  const next = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (Number.isNaN(next.getTime())) return slotStamp;
  next.setHours(next.getHours() + 1);
  const nextYear = next.getFullYear();
  const nextMonth = `${next.getMonth() + 1}`.padStart(2, '0');
  const nextDay = `${next.getDate()}`.padStart(2, '0');
  const nextHours = `${next.getHours()}`.padStart(2, '0');
  const nextMinutes = `${next.getMinutes()}`.padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}T${nextHours}:${nextMinutes}`;
}

export default function ScheduleDayView({
  day,
  dayLabel,
  month,
  totalCount,
  slots,
  teamMembers,
  jobs,
  items,
  initialAt,
  initialItemId = null,
}: ScheduleDayViewProps) {
  const [selectedAt, setSelectedAt] = useState(initialAt);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(initialItemId);

  const selectedItem = useMemo(
    () => (selectedItemId ? items.find((item) => item.id === selectedItemId) ?? null : null),
    [items, selectedItemId]
  );

  const effectiveStartsAt = selectedItem?.starts_at ?? selectedAt;
  const effectiveEndsAt = selectedItem?.ends_at ?? addHourToSlotStamp(selectedAt);

  return (
    <div className="editor schedule-day-editor">
      <div className="editor__main schedule-day">
        <div className="schedule-day__header">
          <div className="schedule-day__header-copy">
            <h2>{dayLabel}</h2>
            <p>{totalCount} scheduled item{totalCount === 1 ? '' : 's'} on this day.</p>
          </div>
        </div>

        <div className="schedule-day__timeline">
          {slots.map((slot) => (
            <section key={slot.hour} className="schedule-day__slot">
              <div className="schedule-day__slot-time">{slot.label}</div>
              <div className="schedule-day__slot-body">
                <div className="schedule-day__slot-head">
                  <span className="schedule-day__slot-count">
                    {slot.entries.length ? `${slot.entries.length} item${slot.entries.length === 1 ? '' : 's'}` : 'Open'}
                  </span>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setSelectedAt(slot.at);
                      setSelectedItemId(null);
                    }}
                  >
                    Add
                  </button>
                </div>
                {slot.entries.length === 0 ? (
                  <div className="schedule-day__slot-empty" aria-hidden="true" />
                ) : (
                  <div className="schedule-day__slot-list">
                    {slot.entries.map((entry) =>
                      entry.type === 'Custom' ? (
                        <button
                          key={`${entry.type}-${entry.id}`}
                          type="button"
                          className={`schedule-day__card schedule-day__card-button${
                            selectedItemId === entry.id ? ' schedule-day__card-button--active' : ''
                          }`}
                          onClick={() => {
                            setSelectedItemId(entry.id);
                            setSelectedAt(entry.startsAt.slice(0, 16));
                          }}
                        >
                          <div className="schedule-day__card-summary">
                            <h3>{entry.title}</h3>
                            <span className="schedule-day__time">{entry.time}</span>
                          </div>
                        </button>
                      ) : (
                        <Link key={`${entry.type}-${entry.id}`} href={entry.href} className="schedule-day__card">
                          <div className="schedule-day__card-summary">
                            <h3>{entry.title}</h3>
                            <span className="schedule-day__time">{entry.time}</span>
                          </div>
                        </Link>
                      )
                    )}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
      <aside className="editor__sidebar">
        <ScheduleDaySidebarForm
          key={selectedItem ? `item-${selectedItem.id}` : `slot-${effectiveStartsAt}`}
          day={day}
          month={month}
          initialStartsAt={effectiveStartsAt}
          initialEndsAt={effectiveEndsAt}
          teamMembers={teamMembers}
          jobs={jobs}
          item={selectedItem}
        />
      </aside>
    </div>
  );
}
