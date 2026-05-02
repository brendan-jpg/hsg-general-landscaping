'use client';

import { ChangeEvent, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/shared/Button';
import UploadIcon from '@/components/shared/icons/UploadIcon';
import { prepareFilesForMediaUpload } from '@/lib/media/clientUpload';
import { FORM_UPLOAD_ACCEPT_ATTRIBUTE, FORM_UPLOAD_MAX_BYTES } from '@/lib/forms/uploadValidation';

type ContactFileItem = {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number | null;
  createdAt: string | null;
  source: 'submission' | 'manual';
  sourceLabel: string;
};

interface ContactFilesPanelProps {
  contactId: string;
  files: ContactFileItem[];
}

function formatFileSize(bytes: number | null) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return null;
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const formatted = value >= 10 || unitIndex === 0 ? Math.round(value).toString() : value.toFixed(1);
  return `${formatted} ${units[unitIndex]}`;
}

function formatWhen(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ContactFilesPanel({ contactId, files }: ContactFilesPanelProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = event.target.files ? Array.from(event.target.files) : [];
    if (selectedFiles.length === 0) return;

    setError(null);
    setIsUploading(true);
    try {
      const filesForUpload = await prepareFilesForMediaUpload(selectedFiles, {
        maxBytes: FORM_UPLOAD_MAX_BYTES,
      });
      const formData = new FormData();
      formData.set('contact_id', contactId);
      formData.set('role', 'generic');
      for (const file of filesForUpload) {
        formData.append('files', file, file.name);
      }

      const response = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; failedFiles?: string[] }
        | null;

      if (!response.ok) {
        throw new Error(
          payload && typeof payload.error === 'string' && payload.error.trim()
            ? payload.error
            : 'Upload failed',
        );
      }

      const failedFiles = Array.isArray(payload?.failedFiles)
        ? payload.failedFiles.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        : [];
      if (failedFiles.length > 0) {
        setError(`Some files could not be uploaded: ${failedFiles.join(', ')}`);
      }

      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <section className="contact-detail__files">
      <div className="contact-detail__files-head">
        <div>
          <h3>Files</h3>
          <p className="contact-detail__summary">
            Client-uploaded form files and anything your team adds to this lead.
          </p>
        </div>
        <div className="contact-detail__files-actions">
          <Button
            type="button"
            variant="btn--secondary"
            icon={<UploadIcon />}
            iconPosition="left"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? 'Uploading...' : 'Add Files'}
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={FORM_UPLOAD_ACCEPT_ATTRIBUTE}
            className="contact-detail__files-input"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {error ? <p className="form-error">{error}</p> : null}

      {files.length > 0 ? (
        <div className="contact-detail__files-list">
          {files.map((file) => {
            const sizeLabel = formatFileSize(file.fileSize);
            const whenLabel = formatWhen(file.createdAt);
            return (
              <a
                key={file.id}
                className="contact-detail__file-card"
                href={file.fileUrl}
                target="_blank"
                rel="noreferrer"
              >
                <div className="contact-detail__file-main">
                  <strong className="contact-detail__file-name">{file.fileName}</strong>
                  <span className="contact-detail__file-meta">
                    {[file.sourceLabel, file.fileType || null, sizeLabel].filter(Boolean).join(' • ')}
                  </span>
                </div>
                {whenLabel ? <span className="contact-detail__file-date">{whenLabel}</span> : null}
              </a>
            );
          })}
        </div>
      ) : (
        <p className="contact-detail__empty">No files attached to this lead yet.</p>
      )}
    </section>
  );
}
