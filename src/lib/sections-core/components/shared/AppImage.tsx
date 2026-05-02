'use client';

import { useEffect, useState, type SyntheticEvent } from 'react';
import Image from 'next/image';

type AppImageProps = React.ComponentProps<typeof Image> & {
  role?: string;
};

function isSvgSrc(src: string) {
  const trimmed = src.trim().toLowerCase();
  if (!trimmed) return false;
  if (trimmed.startsWith('data:image/svg+xml')) return true;
  const withoutQuery = trimmed.split('#')[0]?.split('?')[0] ?? trimmed;
  return withoutQuery.endsWith('.svg');
}

const ROLE_WIDTHS: Record<string, number[]> = {
  hero: [768, 1200, 1600, 2000],
  logo: [160, 220, 320, 480],
  card: [480, 768, 1200],
  content: [768, 1200, 1600],
  gallery: [768, 1200, 1600, 2000],
  avatar: [160, 320, 640, 800],
};

const SOURCE_WIDTHS: number[][] = [
  [768, 1200, 1600, 2000],
  [160, 220, 320, 480],
  [32, 64, 128, 256],
  [480, 768, 1200],
  [768, 1200, 1600],
  [768, 1200, 1600, 2000],
  [160, 320, 640, 800],
  [480, 768, 1200, 1600],
];

const DEFAULT_TARGET_WIDTH: Record<string, number> = {
  hero: 1600,
  logo: 320,
  card: 768,
  content: 1200,
  gallery: 1200,
  avatar: 320,
};

const MANAGED_VARIANT_FILE_RE = /^(.*)-(\d+)w\.(avif|webp|png|jpe?g)$/i;

function parseManagedVariantUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return null;

  let base = trimmed;
  let suffix = '';

  try {
    const parsed = new URL(trimmed);
    base = `${parsed.origin}${parsed.pathname}`;
    suffix = `${parsed.search}${parsed.hash}`;
  } catch {
    const match = trimmed.match(/^([^?#]+)(.*)$/);
    if (match) {
      base = match[1] ?? trimmed;
      suffix = match[2] ?? '';
    }
  }

  const lastSlashIndex = base.lastIndexOf('/');
  const directory = lastSlashIndex >= 0 ? base.slice(0, lastSlashIndex + 1) : '';
  const fileName = lastSlashIndex >= 0 ? base.slice(lastSlashIndex + 1) : base;
  const match = fileName.match(MANAGED_VARIANT_FILE_RE);
  if (!match) return null;

  const [, baseName = '', widthValue = '', formatValue = ''] = match;
  const width = Number.parseInt(widthValue, 10);
  if (!Number.isFinite(width) || width <= 0) return null;

  return {
    directory,
    baseName,
    width,
    format: formatValue.toLowerCase(),
    suffix,
  };
}

function resolveManagedImageUrl(src: string, role?: string, declaredWidth?: number | null) {
  const parsed = parseManagedVariantUrl(src);
  if (!parsed) return src;

  const normalizedRole = role && role in ROLE_WIDTHS ? role : 'content';
  const defaultTargetWidth = DEFAULT_TARGET_WIDTH[normalizedRole] ?? DEFAULT_TARGET_WIDTH.content;
  const targetWidth =
    typeof declaredWidth === 'number' && Number.isFinite(declaredWidth) && declaredWidth > 0
      ? Math.min(defaultTargetWidth, Math.max(declaredWidth * 2, declaredWidth))
      : defaultTargetWidth;
  if (parsed.width <= targetWidth) return src;

  const matchingSets = SOURCE_WIDTHS.filter((set) => set.includes(parsed.width));
  const sharedWidths = matchingSets.length > 0
    ? matchingSets.slice(1).reduce<number[]>((shared, current) => shared.filter((value) => current.includes(value)), [...matchingSets[0]])
    : [parsed.width];
  const availableWidths = sharedWidths
    .filter((candidate) => candidate <= parsed.width)
    .sort((a, b) => a - b);
  const nextWidth = availableWidths.find((candidate) => candidate >= targetWidth)
    ?? availableWidths[availableWidths.length - 1]
    ?? parsed.width;
  if (nextWidth >= parsed.width) return src;

  return `${parsed.directory}${parsed.baseName}-${nextWidth}w.${parsed.format}${parsed.suffix}`;
}

export default function AppImage(props: AppImageProps) {
  const rawStringSrc = typeof props.src === 'string' ? props.src.trim() : null;
  if (rawStringSrc === '') {
    return null;
  }
  const nextSrc =
    rawStringSrc
      ? resolveManagedImageUrl(rawStringSrc, props.role, typeof props.width === 'number' ? props.width : null)
      : props.src;
  const [activeSrc, setActiveSrc] = useState(nextSrc);
  const [didFallbackToOriginal, setDidFallbackToOriginal] = useState(false);

  useEffect(() => {
    setActiveSrc(nextSrc);
    setDidFallbackToOriginal(false);
  }, [nextSrc]);

  function handleError(event: SyntheticEvent<HTMLImageElement, Event>) {
    if (
      !didFallbackToOriginal
      && rawStringSrc
      && typeof nextSrc === 'string'
      && nextSrc !== rawStringSrc
      && activeSrc === nextSrc
    ) {
      setDidFallbackToOriginal(true);
      setActiveSrc(rawStringSrc);
    }

    props.onError?.(event);
  }

  return (
    <Image
      {...props}
      src={activeSrc}
      onError={handleError}
      unoptimized={rawStringSrc ? isSvgSrc(rawStringSrc) || props.unoptimized === true : props.unoptimized}
    />
  );
}
