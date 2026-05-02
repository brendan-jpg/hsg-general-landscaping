import Link from 'next/link';
import ModuleShell from '@/components/backend/shell/ModuleShell';
import DataTable from '../../../../components/backend/DataTable';
import Button from '@/components/shared/Button';
import {
  deleteTestimonialsBulk,
} from '@/lib/actions';
import { getDashboardTestimonials } from '@/lib/content/queries';

function renderRating(rating: number | null) {
  if (!rating) return '-';
  return `${rating}/5`;
}

export default async function TestimonialsManagePage() {
  const testimonials = await getDashboardTestimonials();

  return (
    <ModuleShell
      title="Testimonials"
      description="Manage customer reviews and testimonials"
      footer={<div id="testimonials-list-bulk-controls" />}
    >
      <DataTable
        headerAction={
          <Button as="link" href="/dashboard/testimonials/new">
            New Testimonial
          </Button>
        }
        columns={['Customer', 'Rating', 'Source', 'Featured', 'Active', 'Date']}
        rows={testimonials.map((testimonial) => ({
          Customer: <Link href={`/dashboard/testimonials/${testimonial.id}`}>{testimonial.customer_name}</Link>,
          Rating: renderRating(testimonial.rating),
          Source: testimonial.source,
          Featured: testimonial.is_featured ? 'Yes' : 'No',
          Active: testimonial.is_active ? 'Yes' : 'No',
          Date: testimonial.review_date
            ? new Date(testimonial.review_date).toLocaleDateString()
            : '-',
        }))}
        rowHrefs={testimonials.map((testimonial) => `/dashboard/testimonials/${testimonial.id}`)}
        bulkDelete={{
          rowIds: testimonials.map((testimonial) => testimonial.id),
          onDeleteSelected: deleteTestimonialsBulk,
          itemLabel: 'testimonials',
        }}
        bulkDeletePortalTargetId="testimonials-list-bulk-controls"
        bulkDeleteSelectLabel={`${testimonials.length} Total`}
        emptyMessage="No testimonials yet"
      />
    </ModuleShell>
  );
}
