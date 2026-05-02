import { notFound, redirect } from 'next/navigation';
import { getDashboardScheduleItemById } from '@/lib/operations/queries';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ScheduleItemRedirectPage({ params }: Props) {
  const { id } = await params;
  if (id === 'new') redirect('/dashboard/schedule');

  const item = await getDashboardScheduleItemById(id);
  if (!item?.starts_at) notFound();

  const startsAt = new Date(item.starts_at);
  if (Number.isNaN(startsAt.getTime())) notFound();

  const day = `${startsAt.getFullYear()}-${`${startsAt.getMonth() + 1}`.padStart(2, '0')}-${`${startsAt.getDate()}`.padStart(2, '0')}`;
  redirect(`/dashboard/schedule/day/${day}?item=${id}`);
}
