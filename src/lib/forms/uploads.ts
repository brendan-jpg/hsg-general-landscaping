import type { Json } from '@/lib/types/database';

export interface UploadedFormFileValue {
  file_name: string;
  file_size: number;
  file_type: string;
  file_url: string;
  storage_path?: string;
}

export const FORM_UPLOAD_VALUE_PREFIX = '__uploaded_file__:';

export function isUploadedFormFileValue(value: unknown): value is UploadedFormFileValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.file_name === 'string' &&
    typeof record.file_size === 'number' &&
    Number.isFinite(record.file_size) &&
    typeof record.file_type === 'string' &&
    typeof record.file_url === 'string' &&
    (record.storage_path === undefined || typeof record.storage_path === 'string')
  );
}

export function serializeUploadedFormFileValue(value: UploadedFormFileValue) {
  return `${FORM_UPLOAD_VALUE_PREFIX}${JSON.stringify(value)}`;
}

export function parseUploadedFormFileValue(raw: string): UploadedFormFileValue | null {
  if (!raw.startsWith(FORM_UPLOAD_VALUE_PREFIX)) return null;

  try {
    const parsed = JSON.parse(raw.slice(FORM_UPLOAD_VALUE_PREFIX.length)) as unknown;
    if (!isUploadedFormFileValue(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function uploadedFormFileValueToJson(value: UploadedFormFileValue): Json {
  return {
    file_name: value.file_name,
    file_size: value.file_size,
    file_type: value.file_type,
    file_url: value.file_url,
    ...(value.storage_path ? { storage_path: value.storage_path } : {}),
  } as Json;
}

export function collectUploadedFormFiles(value: unknown): UploadedFormFileValue[] {
  const files: UploadedFormFileValue[] = [];

  function visit(next: unknown) {
    if (isUploadedFormFileValue(next)) {
      files.push(next);
      return;
    }

    if (Array.isArray(next)) {
      next.forEach(visit);
      return;
    }

    if (next && typeof next === 'object') {
      Object.values(next as Record<string, unknown>).forEach(visit);
    }
  }

  visit(value);
  return files;
}
