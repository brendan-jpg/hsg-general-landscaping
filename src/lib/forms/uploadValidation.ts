export const FORM_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

const FORM_UPLOAD_ALLOWED_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'csv',
  'txt',
]);

const FORM_UPLOAD_ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain',
]);

const EXTENSION_TO_CONTENT_TYPE: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  txt: 'text/plain',
};

export const FORM_UPLOAD_ACCEPT_ATTRIBUTE = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.csv',
  '.txt',
].join(',');

type UploadFileLike = {
  name: string;
  size: number;
  type?: string | null;
};

function getFileExtension(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  const lastDot = normalized.lastIndexOf('.');
  if (lastDot === -1) return '';
  return normalized.slice(lastDot + 1);
}

export function getFormUploadMaxSizeLabel() {
  return `${Math.round(FORM_UPLOAD_MAX_BYTES / (1024 * 1024))}MB`;
}

export function validateFormUploadFile(file: UploadFileLike) {
  const name = file.name.trim();
  if (!name) {
    throw new Error('A valid file is required.');
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new Error('A valid file is required.');
  }

  if (file.size > FORM_UPLOAD_MAX_BYTES) {
    throw new Error(`"${name}" is too large. Please use a file under ${getFormUploadMaxSizeLabel()}.`);
  }

  const extension = getFileExtension(name);
  const normalizedType = (file.type ?? '').trim().toLowerCase();
  const inferredType = EXTENSION_TO_CONTENT_TYPE[extension] ?? '';
  const contentType =
    normalizedType && normalizedType !== 'application/octet-stream'
      ? normalizedType
      : inferredType || 'application/octet-stream';

  const isAllowedExtension = FORM_UPLOAD_ALLOWED_EXTENSIONS.has(extension);
  const isAllowedMimeType = FORM_UPLOAD_ALLOWED_MIME_TYPES.has(contentType);
  const isAllowedImageType = contentType.startsWith('image/');

  if (!isAllowedExtension && !isAllowedMimeType && !isAllowedImageType) {
    throw new Error('Unsupported file type. Please use an image, PDF, Word, Excel, CSV, or text file.');
  }

  return {
    contentType,
  };
}
