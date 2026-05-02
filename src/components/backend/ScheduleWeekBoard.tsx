'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { rescheduleScheduleEntryAction } from '@/lib/actions';

interface ScheduleWeekEntry {
  id: string;
  sourceType: 'job' | 'custom';
  title: string;
  assignedLabel: string;
  statusLabel: string;
  startsAt: string;
  endsAt: string | null;
  href: string;
}

interface ScheduleWeekBoardProps {
  weekStart: string; // YYYY-MM-DD local week start (Sunday)
  entries: ScheduleWeekEntry[];
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

function formatDayHeader(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
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

export default function ScheduleWeekBoard({ weekStart, entries }: ScheduleWeekBoardProps) {
  const router = useRouter();
  const [pendingDropKey, setPendingDropKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const weekStartDate = useMemo(() => {
    const [year, month, day] = weekStart.split('-').map((value) => Number(value));
    return new Date(year, (month || 1) - 1, day || 1);
  }, [weekStart]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStartDate, index)),
    [weekStartDate]
  );

  const entriesByDay = useMemo(() => {
    const buckets = new Map<number, ScheduleWeekEntry[]>();
    for (let i = 0; i < 7; i += 1) buckets.set(i, []);

    for (const entry of entries) {
      const date = new Date(entry.startsAt);
      if (Number.isNaN(date.getTime())) continue;
      const dayStart = startOfDay(date);
      const diffMs = dayStart.getTime() - startOfDay(weekStartDate).getTime();
      const dayIndex = Math.floor(diffMs / 86_400_000);
      if (dayIndex < 0 || dayIndex > 6) continue;
      buckets.get(dayIndex)?.push(entry);
    }

    for (const [index, bucket] of buckets.entries()) {
      bucket.sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
      buckets.set(index, bucket);
    }

    return buckets;
  }, [entries, weekStartDate]);

  async function handleDrop(dayIndex: number, rawPayload: string) {
    try {
      const payload = JSON.parse(rawPayload) as { id: string; sourceType: 'job' | 'custom' };
      const entry = entries.find(
        (candidate) => candidate.id === payload.id && candidate.sourceType === payload.sourceType
      );
      if (!entry) return;

      const currentDayIndex = Math.floor(
        (startOfDay(new Date(entry.startsAt)).getTime() - startOfDay(weekStartDate).getTime()) / 86_400_000
      );
      if (currentDayIndex === dayIndex) return;

      const dayDelta = dayIndex - currentDayIndex;
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
    <div className="schedule-week">
      <div className="schedule-week__grid">
        {days.map((day, dayIndex) => {
          const cards = entriesByDay.get(dayIndex) ?? [];
          return (
            <div
              key={`${weekStart}-${dayIndex}`}
              className="schedule-week__column"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void handleDrop(dayIndex, event.dataTransfer.getData('text/plain'));
              }}
            >
              <div className="schedule-week__column-header">{formatDayHeader(day)}</div>
              <div className="schedule-week__column-body">
                {cards.length === 0 ? (
                  <p className="schedule-week__empty">No items</p>
                ) : (
                  cards.map((entry) => {
                    const cardKey = `${entry.sourceType}:${entry.id}`;
                    const isUpdating = pendingDropKey === cardKey && isPending;
                    return (
                      <div
                        key={cardKey}
                        className={`schedule-week__card schedule-week__card--${entry.sourceType}`}
                        draggable={!isPending}
                        onDragStart={(event) => {
                          event.dataTransfer.setData(
                            'text/plain',
                            JSON.stringify({ id: entry.id, sourceType: entry.sourceType })
                          );
                          event.dataTransfer.effectAllowed = 'move';
                        }}
                      >
                        <div className="schedule-week__card-summary">
                          <Link href={entry.href} className="schedule-week__card-title">
                            {entry.title}
                          </Link>
                          <p className="schedule-week__card-time">{formatStartTime(entry.startsAt)}</p>
                        </div>
                        {isUpdating ? <span className="schedule-week__saving">Moving...</span> : null}
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
