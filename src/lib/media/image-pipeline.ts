import 'server-only';

import path from 'node:path';
import sharp from 'sharp';

export type MediaImageRole = 'hero' | 'logo' | 'icon' | 'card' | 'content' | 'gallery' | 'avatar' | 'graphic' | 'generic';

type VariantFormat = 'avif' | 'webp' | 'jpeg' | 'png';

export interface ProcessImageUploadInput {
  buffer: Buffer;
  fileName: string;
  contentType: string;
  role?: MediaImageRole;
}

export interface ProcessedImageVariant {
  format: VariantFormat;
  width: number;
  height: number;
  bytes: number;
  contentType: string;
  fileName: string;
  buffer: Buffer;
}

export interface ProcessedImageUpload {
  width: number;
  height: number;
  hasAlpha: boolean;
  sourceFormat: string | null;
  blurDataUrl: string | null;
  original: {
    fileName: string;
    contentType: string;
    bytes: number;
  };
  variants: ProcessedImageVariant[];
}

const ROLE_WIDTHS: Record<MediaImageRole, number[]> = {
  hero: [768, 1200, 1600, 2000],
  logo: [160, 220, 320, 480],
  icon: [32, 64, 128, 256],
  card: [480, 768, 1200],
  content: [768, 1200, 1600],
  gallery: [768, 1200, 1600, 2000],
  avatar: [160, 320, 640, 800],
  graphic: [480, 768, 1200, 1600],
  generic: [480, 768, 1200, 1600],
};

function getFileBaseName(fileName: string) {
  const parsed = path.parse(fileName);
  return parsed.name.replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'image';
}

function getFormats(hasAlpha: boolean, role: MediaImageRole): VariantFormat[] {
  if (role === 'logo' || role === 'icon') {
    return hasAlpha ? ['webp', 'png'] : ['webp', 'png'];
  }

  if (hasAlpha) {
    return ['webp', 'png'];
  }

  // Some storage backends reject image/avif uploads even when the file bytes are valid.
  // Prefer WebP/JPEG to keep uploads reliable.
  return ['webp', 'jpeg'];
}

async function encodeVariant(
  base: sharp.Sharp,
  format: VariantFormat
): Promise<{ buffer: Buffer; contentType: string }> {
  switch (format) {
    case 'avif':
      return { buffer: await base.avif({ quality: 50, effort: 4 }).toBuffer(), contentType: 'image/avif' };
    case 'webp':
      return { buffer: await base.webp({ quality: 75 }).toBuffer(), contentType: 'image/webp' };
    case 'jpeg':
      return { buffer: await base.jpeg({ quality: 78, mozjpeg: true }).toBuffer(), contentType: 'image/jpeg' };
    case 'png':
      return { buffer: await base.png({ compressionLevel: 9, palette: true, quality: 80 }).toBuffer(), contentType: 'image/png' };
    default:
      throw new Error(`Unsupported output format: ${String(format)}`);
  }
}

export async function processImageUpload({
  buffer,
  fileName,
  contentType,
  role = 'generic',
}: ProcessImageUploadInput): Promise<ProcessedImageUpload> {
  const image = sharp(buffer, { failOn: 'none' }).rotate();
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error('Unable to read image dimensions.');
  }

  if (metadata.pages && metadata.pages > 1) {
    throw new Error('Animated images are not supported by the managed image pipeline.');
  }

  const width = metadata.width;
  const height = metadata.height;
  const hasAlpha = Boolean(metadata.hasAlpha);
  const sourceFormat = metadata.format ?? null;

  const blurBuffer = await sharp(buffer)
    .rotate()
    .resize(24, 24, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 40 })
    .toBuffer();
  const blurDataUrl = `data:image/webp;base64,${blurBuffer.toString('base64')}`;

  const targetWidths = ROLE_WIDTHS[role]
    .filter((candidate) => candidate < width)
    .concat(width)
    .filter((candidate, index, list) => list.indexOf(candidate) === index)
    .sort((a, b) => a - b);

  const formats = getFormats(hasAlpha, role);
  const baseName = getFileBaseName(fileName);
  const variants: ProcessedImageVariant[] = [];

  for (const targetWidth of targetWidths) {
    const resizedBase = sharp(buffer)
      .rotate()
      .resize({
        width: targetWidth,
        fit: 'inside',
        withoutEnlargement: true,
      });

    const outWidth = targetWidth;
    const outHeight = Math.max(1, Math.round((height * outWidth) / width));

    for (const format of formats) {
      const { buffer: variantBuffer, contentType: variantContentType } = await encodeVariant(
        resizedBase.clone(),
        format
      );

      variants.push({
        format,
        width: outWidth,
        height: outHeight,
        bytes: variantBuffer.byteLength,
        contentType: variantContentType,
        fileName: `${baseName}-${outWidth}w.${format === 'jpeg' ? 'jpg' : format}`,
        buffer: variantBuffer,
      });
    }
  }

  return {
    width,
    height,
    hasAlpha,
    sourceFormat,
    blurDataUrl,
    original: {
      fileName,
      contentType,
      bytes: buffer.byteLength,
    },
    variants,
  };
}

export function chooseCanonicalVariant(result: ProcessedImageUpload) {
  const preferredFormats: VariantFormat[] = ['webp', 'avif', 'jpeg', 'png'];
  const byLargestFirst = [...result.variants].sort((a, b) => b.width - a.width || preferredFormats.indexOf(a.format) - preferredFormats.indexOf(b.format));

  const preferred = byLargestFirst.find((variant) => variant.format === 'webp')
    ?? byLargestFirst.find((variant) => variant.format === 'avif')
    ?? byLargestFirst[0];

  if (!preferred) {
    throw new Error('No variants were generated.');
  }

  return preferred;
}
