import { redirect } from 'next/navigation';

export default function BlogManagePage() {
  redirect('/dashboard/content?tab=blogs');
}
