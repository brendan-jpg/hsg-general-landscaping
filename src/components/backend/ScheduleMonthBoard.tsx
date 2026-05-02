'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { rescheduleScheduleEntryAction } from '@/lib/actions';

interface ScheduleMonthEntry {
  id: string;
  sourceType: 'job' | 'custom';
  title: string;
  assignedLabel: string;
  statusLabel: string;
  startsAt: string;
  endsAt: string | null;
  href: string;
}

interface ScheduleMonthBoardProps {
  monthStart: string; // YYYY-MM-01
  entries: ScheduleMonthEntry[];
  dayHrefBase?: string;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toDayKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatStartTime(startsAt: string) {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return startsAt;
  return start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function shiftDateKeepingTime(iso: string, days: number) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export default function ScheduleMonthBoard({
  monthStart,
  entries,
  dayHrefBase,
}: ScheduleMonthBoardProps) {
  const router = useRouter();
  const [pendingDropKey, setPendingDropKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const monthStartDate = useMemo(() => {
    const [year, month, day] = monthStart.split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
  }, [monthStart]);

  const gridStart = useMemo(() => addDays(monthStartDate, -monthStartDate.getDay()), [monthStartDate]);
  const todayKey = useMemo(() => toDayKey(new Date()), []);

  const days = useMemo(
    () => Array.from({ length: 35 }, (_, index) => addDays(gridStart, index)),
    [gridStart]
  );

  const entriesByDay = useMemo(() => {
    const buckets = new Map<string, ScheduleMonthEntry[]>();
    for (const day of days) buckets.set(toDayKey(day), []);

    for (const entry of entries) {
      const date = new Date(entry.startsAt);
      if (Number.isNaN(date.getTime())) continue;
      const key = toDayKey(startOfDay(date));
      if (!buckets.has(key)) continue;
      buckets.get(key)?.push(entry);
    }

    for (const [key, bucket] of buckets.entries()) {
      bucket.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
      buckets.set(key, bucket);
    }

    return buckets;
  }, [days, entries]);

  async function handleDrop(targetDay: Date, rawPayload: string) {
    try {
      const payload = JSON.parse(rawPayload) as { id: string; sourceType: 'job' | 'custom' };
      const entry = entries.find(
        (candidate) => candidate.id === payload.id && candidate.sourceType === payload.sourceType
      );
      if (!entry) return;

      const currentDay = startOfDay(new Date(entry.startsAt));
      const nextDay = startOfDay(targetDay);
      const dayDelta = Math.round((nextDay.getTime() - currentDay.getTime()) / 86_400_000);
      if (dayDelta === 0) return;

      const nextStartsAt = shiftDateKeepingTime(entry.startsAt, dayDelta);
      const nextEndsAt = entry.endsAt ? shiftDateKeepingTime(entry.endsAt, dayDelta) : null;
      const key = `${payload.sourceType}:${payload.id}`;
      setPendingDropKey(key);

      startTransition(async () => {
        try {
          await rescheduleScheduleEntryAction({
            sourceType: payload.sourceType,
            id: payload.id,
            startsAt: nextStartsAt,
            endsAt: nextEndsAt,
          });
          router.refresh();
        } catch (error) {
          window.alert(error instanceof Error ? error.message : 'Unable to reschedule item');
        } finally {
          setPendingDropKey(null);
        }
      });
    } catch {
      // Ignore malformed drag payloads.
    }
  }

  return (
    <div className="schedule-month">
      <div className="schedule-month__weekdays">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
          <div key={label} className="schedule-month__weekday">
            {label}
          </div>
        ))}
      </div>
      <div className="schedule-month__grid">
        {days.map((day) => {
          const key = toDayKey(day);
          const cards = entriesByDay.get(key) ?? [];
          const isCurrentMonth = day.getMonth() === monthStartDate.getMonth();
          const isToday = key === todayKey;
          return (
            <div
              key={key}
              className={`schedule-month__cell${isCurrentMonth ? '' : ' schedule-month__cell--outside'}${isToday ? ' schedule-month__cell--today' : ''}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void handleDrop(day, event.dataTransfer.getData('text/plain'));
              }}
            >
              <div className="schedule-month__cell-head">
                {dayHrefBase ? (
                  <Link
                    href={`${dayHrefBase}/${key}`}
                    className={`schedule-month__date-link${isToday ? ' schedule-month__date-link--today' : ''}`}
                  >
                    <span className="schedule-month__date">{day.getDate()}</span>
                  </Link>
                ) : (
                  <span className="schedule-month__date">{day.getDate()}</span>
                )}
                <span className="schedule-month__count">{cards.length || ''}</span>
              </div>
              <div className="schedule-month__items">
                {cards.length === 0 ? (
                  <p className="schedule-month__empty">No items</p>
                ) : (
                  cards.map((entry) => {
                    const cardKey = `${entry.sourceType}:${entry.id}`;
                    const isUpdating = pendingDropKey === cardKey && isPending;
                    return (
                      <div
                        key={cardKey}
                        className={`schedule-month__item schedule-month__item--${entry.sourceType}`}
                        draggable={!isPending}
                        onDragStart={(event) => {
                          event.dataTransfer.setData(
                            'text/plain',
                            JSON.stringify({ id: entry.id, sourceType: entry.sourceType })
                          );
                          event.dataTransfer.effectAllowed = 'move';
                        }}
                      >
                        <div className="schedule-month__item-summary">
                          <Link href={entry.href} className="schedule-month__item-title">
                            {entry.title}
                          </Link>
                          <p className="schedule-month__item-time">{formatStartTime(entry.startsAt)}</p>
                        </div>
                        {isUpdating ? <span className="schedule-month__saving">Moving...</span> : null}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
