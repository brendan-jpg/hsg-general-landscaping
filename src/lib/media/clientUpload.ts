'use client';

const MAX_DIRECT_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_OPTIMIZED_UPLOAD_BYTES = 3.5 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 2560;

function inferFileType(file: File) {
  if (file.type && file.type !== 'application/octet-stream') return file.type;
  const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : '';
  if (extension === 'heic') return 'image/heic';
  if (extension === 'heif') return 'image/heif';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'pdf') return 'application/pdf';
  return 'application/octet-stream';
}

function isHeicLikeFile(file: File) {
  const fileType = inferFileType(file);
  return fileType === 'image/heic' || fileType === 'image/heif';
}

function isRasterImage(file: File) {
  const fileType = inferFileType(file);
  return fileType.startsWith('image/') && fileType !== 'image/svg+xml' && fileType !== 'image/gif';
}

function replaceFileExtension(fileName: string, nextExtension: string) {
  const baseName = fileName.replace(/\.[^/.]+$/, '');
  return `${baseName}.${nextExtension}`;
}

async function convertHeicToJpeg(file: File) {
  const heic2any = (await import('heic2any')).default;
  const converted = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.9,
  });

  const outputBlob = Array.isArray(converted) ? converted[0] : converted;
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  return new File([outputBlob], `${baseName}.jpg`, { type: 'image/jpeg' });
}

async function loadImageElement(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error(`Unable to read image "${file.name}".`));
      nextImage.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });

  if (!blob) {
    throw new Error('Unable to optimize this image for upload.');
  }

  return blob;
}

async function optimizeRasterImageForUpload(file: File) {
  const image = await loadImageElement(file);
  const longestEdge = Math.max(image.naturalWidth, image.naturalHeight, 1);
  const initialScale = Math.min(1, MAX_IMAGE_DIMENSION / longestEdge);
  const outputType =
    inferFileType(file) === 'image/png' || inferFileType(file) === 'image/webp'
      ? 'image/webp'
      : 'image/jpeg';
  const extension = outputType === 'image/webp' ? 'webp' : 'jpg';
  const qualitySteps = outputType === 'image/webp' ? [0.84, 0.76, 0.68, 0.6] : [0.86, 0.78, 0.7, 0.6];
  const scaleSteps = [1, 0.9, 0.8, 0.7];

  for (const scaleStep of scaleSteps) {
    const scale = initialScale * scaleStep;
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Unable to prepare an image canvas for upload.');
    }

    context.drawImage(image, 0, 0, width, height);

    for (const quality of qualitySteps) {
      const blob = await canvasToBlob(canvas, outputType, quality);
      if (blob.size <= MAX_OPTIMIZED_UPLOAD_BYTES) {
        return new File([blob], replaceFileExtension(file.name, extension), {
          type: outputType,
          lastModified: file.lastModified,
        });
      }
    }
  }

  throw new Error(
    `"${file.name}" is too large to upload. Please use an image under ${Math.round(MAX_DIRECT_UPLOAD_BYTES / (1024 * 1024))}MB.`,
  );
}

export async function prepareFilesForMediaUpload(
  files: File[],
  options?: { onProgress?: (done: number, total: number) => void; maxBytes?: number },
) {
  const total = files.length;
  const convertedFiles: File[] = [];
  const maxBytes = options?.maxBytes ?? MAX_DIRECT_UPLOAD_BYTES;

  for (let index = 0; index < files.length; index += 1) {
    let nextFile = files[index];
    if (isHeicLikeFile(nextFile)) {
      try {
        nextFile = await convertHeicToJpeg(nextFile);
      } catch (error) {
        console.warn('HEIC conversion failed, falling back to server-side processing.', nextFile.name, error);
      }
    }

    if (isRasterImage(nextFile) && nextFile.size > maxBytes) {
      nextFile = await optimizeRasterImageForUpload(nextFile);
    } else if (nextFile.size > maxBytes) {
      throw new Error(
        `"${nextFile.name}" is too large to upload. Please use a file under ${Math.round(maxBytes / (1024 * 1024))}MB.`,
      );
    }

    convertedFiles.push(nextFile);
    options?.onProgress?.(index + 1, total);
  }

  return convertedFiles;
}

