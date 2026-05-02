import { notFound } from 'next/navigation';
import ModuleShell from '@/components/backend/shell/ModuleShell';
import TestimonialEditorForm from '@/components/backend/TestimonialEditorForm';
import {
  deleteGoogleBusinessProfileReviewReplyAction,
  upsertGoogleBusinessProfileReviewReplyAction,
} from '@/lib/actions';
import {
  getDashboardAreas,
  getDashboardServicesForSelection,
  getDashboardTestimonialById,
} from '@/lib/content/queries';

interface Props {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    google_reply?: string;
    google_reply_message?: string;
    google_reply_review?: string;
  }>;
}

export default async function TestimonialEditorPage({ params, searchParams }: Props) {
  const { id } = await params;
  const isNew = id === 'new';
  const query = (searchParams ? await searchParams : {}) ?? {};

  const testimonial = isNew ? null : await getDashboardTestimonialById(id);
  if (!isNew && !testimonial) notFound();

  const [serviceOptions, AreaOptions] = await Promise.all([
    getDashboardServicesForSelection(),
    getDashboardAreas(),
  ]);
  const replyFormId = `testimonial-google-reply-${id}`;
  const deleteReplyFormId = `testimonial-google-reply-delete-${id}`;

  const googleReplyFeedback =
    query.google_reply === 'success' ? (
      <p className="testimonial-editor__reply-feedback">
        {query.google_reply_message || 'Google review reply saved'}
        {query.google_reply_review ? ` (${query.google_reply_review})` : ''}.
      </p>
    ) : query.google_reply === 'error' ? (
      <p className="form-error testimonial-editor__reply-feedback">
        {query.google_reply_message || 'Google review reply failed'}
      </p>
    ) : null;

  const googleReplySection =
    !isNew && testimonial?.source === 'google' && testimonial.source_url ? (
      <section className="testimonial-editor__reply-card">
        <div className="testimonial-editor__reply-header">
          <h3>Google Review Reply</h3>
          <p>Manage the reply for this synced Google review.</p>
        </div>
        {googleReplyFeedback}
        <div className="testimonial-editor__reply-form">
          <input type="hidden" name="review_reference" value={testimonial.source_url} form={replyFormId} />
          <input
            type="hidden"
            name="redirect_to"
            value={`/dashboard/testimonials/${testimonial.id}`}
            form={replyFormId}
          />
          <input type="hidden" name="review_reference" value={testimonial.source_url} form={deleteReplyFormId} />
          <input
            type="hidden"
            name="redirect_to"
            value={`/dashboard/testimonials/${testimonial.id}`}
            form={deleteReplyFormId}
          />
          <label className="testimonial-editor__reply-field">
            <span>Reply</span>
            <textarea
              name="reply_comment"
              rows={3}
              placeholder="Thanks for your feedback..."
              form={replyFormId}
              required
            />
          </label>
          <div className="testimonial-editor__reply-actions">
            <button type="submit" className="btn btn--secondary" form={replyFormId}>
              Save Reply
            </button>
            <button type="submit" className="btn btn--ghost" form={deleteReplyFormId}>
              Delete Reply
            </button>
          </div>
        </div>
      </section>
    ) : googleReplyFeedback;

  return (
    <ModuleShell title={isNew ? 'New Testimonial' : 'Edit Testimonial'}>
      <TestimonialEditorForm
        testimonial={testimonial}
        serviceOptions={serviceOptions}
        AreaOptions={AreaOptions.map((area) => ({ id: area.id, name: area.name }))}
        supplementalContent={googleReplySection}
      />
      {!isNew && testimonial?.source === 'google' && testimonial.source_url && (
        <>
          <form id={replyFormId} action={upsertGoogleBusinessProfileReviewReplyAction} hidden />
          <form id={deleteReplyFormId} action={deleteGoogleBusinessProfileReviewReplyAction} hidden />
        </>
      )}
    </ModuleShell>
  );
}
