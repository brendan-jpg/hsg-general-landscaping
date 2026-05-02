'use client';

import { FormEvent, ReactNode, useState } from 'react';
import EditorSaveButton from '@/components/backend/EditorSaveButton';
import useDirtyState from '@/components/backend/useDirtyState';
import { useRouter } from 'next/navigation';
import { deleteTestimonial, saveTestimonial } from '@/lib/actions';
import type { Tables } from '@/lib/types/database';

type Testimonial = Tables<'testimonials'>;

interface ServiceOption {
  id: string;
  title: string;
}

interface AreaOption {
  id: string;
  name: string;
}

interface TestimonialEditorFormProps {
  testimonial: Testimonial | null;
  serviceOptions: ServiceOption[];
  AreaOptions: AreaOption[];
  supplementalContent?: ReactNode;
}

function toNumberValue(value: number | null | undefined) {
  return value === null || value === undefined ? '' : String(value);
}

function toDateInputValue(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export default function TestimonialEditorForm({
  testimonial,
  serviceOptions,
  AreaOptions,
  supplementalContent,
}: TestimonialEditorFormProps) {
  const router = useRouter();
  const isGoogleSyncedReview = testimonial?.source === 'google';
  const [customerName, setCustomerName] = useState(testimonial?.customer_name ?? '');
  const [areaId, setAreaId] = useState(testimonial?.area_id ?? '');
  const [content, setContent] = useState(testimonial?.content ?? '');
  const [rating, setRating] = useState(toNumberValue(testimonial?.rating));
  const [source, setSource] = useState<Testimonial['source']>(testimonial?.source ?? 'manual');
  const [sourceUrl] = useState(testimonial?.source_url ?? '');
  const avatarUrl = testimonial?.avatar_url ?? '';
  const [serviceId, setServiceId] = useState(testimonial?.service_id ?? '');
  const [reviewDate, setReviewDate] = useState(toDateInputValue(testimonial?.review_date));
  const [isFeatured, setIsFeatured] = useState(testimonial?.is_featured ?? false);
  const [isActive, setIsActive] = useState(testimonial?.is_active ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDirty = useDirtyState({
    customerName,
    areaId,
    content,
    rating,
    source,
    sourceUrl,
    avatarUrl,
    serviceId,
    reviewDate,
    isFeatured,
    isActive,
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const formData = new FormData();
      if (testimonial?.id) formData.set('id', testimonial.id);
      formData.set('customer_name', customerName);
      formData.set('area_id', areaId);
      formData.set('content', content);
      formData.set('rating', rating);
      formData.set('source', source);
      formData.set('source_url', sourceUrl);
      formData.set('avatar_url', avatarUrl);
      formData.set('service_id', serviceId);
      formData.set('review_date', reviewDate);
      if (isFeatured) formData.set('is_featured', 'on');
      if (!isActive) formData.set('is_active', 'off');

      await saveTestimonial(formData);
      router.push('/dashboard/testimonials');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save testimonial');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!testimonial?.id) return;
    if (!window.confirm('Delete this testimonial? This cannot be undone.')) return;

    setError(null);
    setIsDeleting(true);
    try {
      await deleteTestimonial(testimonial.id);
      router.push('/dashboard/testimonials');
      router.refresh();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete testimonial');
      setIsDeleting(false);
    }
  }

  return (
    <form className="editor" onSubmit={handleSubmit}>
      <div className="editor__main">
        <input
          className="editor__title-input"
          type="text"
          placeholder="Customer name"
          value={customerName}
          onChange={(event) => setCustomerName(event.target.value)}
          readOnly={isGoogleSyncedReview}
          required
        />
        <textarea
          className="editor__excerpt"
          placeholder="What did the customer say?"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={5}
          readOnly={isGoogleSyncedReview}
          required
        />
        {isGoogleSyncedReview ? (
          <div className="testimonial-editor__sync-note">
            <h3>Google review sync</h3>
            <p>
              This review is managed by Google. You can control whether it displays on your site and tag it to a
              service or area, but the review text and rating stay locked to the synced source.
            </p>
          </div>
        ) : null}
        {supplementalContent}
      </div>
      <aside className="editor__sidebar">
        <div className="editor__field-group">
          <label>Source</label>
          <select
            value={source}
            onChange={(event) => setSource(event.target.value as Testimonial['source'])}
            disabled={isGoogleSyncedReview}
          >
            <option value="manual">Manual</option>
            <option value="google">Google</option>
            <option value="yelp">Yelp</option>
            <option value="facebook">Facebook</option>
          </select>
        </div>
        <div className="editor__field-group">
          <label>Rating (1-5)</label>
          <input
            type="number"
            min={1}
            max={5}
            step={1}
            value={rating}
            onChange={(event) => setRating(event.target.value)}
            readOnly={isGoogleSyncedReview}
          />
        </div>
        <div className="editor__field-group">
          <label>Review Date</label>
          <input
            type="date"
            value={reviewDate}
            onChange={(event) => setReviewDate(event.target.value)}
            readOnly={isGoogleSyncedReview}
          />
        </div>
        <div className="editor__field-group">
          <label>Area</label>
          <select value={areaId} onChange={(event) => setAreaId(event.target.value)}>
            <option value="">None</option>
            {AreaOptions.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </div>
        <div className="editor__field-group">
          <label>Service</label>
          <select value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
            <option value="">None</option>
            {serviceOptions.map((service) => (
              <option key={service.id} value={service.id}>
                {service.title}
              </option>
            ))}
          </select>
        </div>
        <div className="editor__field-group">
          <label>
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(event) => setIsFeatured(event.target.checked)}
            />{' '}
            Featured on homepage
          </label>
          <label>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
            />{' '}
            Active
          </label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="editor__field-group">
          <EditorSaveButton isDirty={isDirty} isSaving={isSaving} disabled={isSaving || isDeleting} />
          {testimonial?.id && (
            <button className="btn" type="button" onClick={handleDelete} disabled={isSaving || isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          )}
        </div>
      </aside>
    </form>
  );
}
