'use client';

import { useEffect, useState, type SyntheticEvent } from 'react';
import Image, { type ImageProps } from 'next/image';
import { resolveManagedImageUrl } from '@/lib/media/variants';

export type AppImageRole = 'hero' | 'logo' | 'card' | 'content' | 'gallery' | 'avatar';

const roleDefaults: Record<AppImageRole, Partial<ImageProps>> = {
  hero: {
    priority: true,
    fetchPriority: 'high',
    sizes: '100vw',
  },
  logo: {
    sizes: '(max-width: 768px) 160px, 220px',
  },
  card: {
    sizes: '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  },
  content: {
    sizes: '(max-width: 768px) 100vw, 1200px',
  },
  gallery: {
    sizes: '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
  },
  avatar: {
    sizes: '(max-width: 768px) 120px, 160px',
  },
};

type AppImageProps = ImageProps & {
  role: AppImageRole;
};

function isSvgSrc(src: string) {
  const trimmed = src.trim().toLowerCase();
  if (!trimmed) return false;
  if (trimmed.startsWith('data:image/svg+xml')) return true;
  const withoutQuery = trimmed.split('#')[0]?.split('?')[0] ?? trimmed;
  return withoutQuery.endsWith('.svg');
}

export default function AppImage({ role, ...props }: AppImageProps) {
  const alt = typeof props.alt === 'string' ? props.alt : '';
  const rawStringSrc = typeof props.src === 'string' ? props.src.trim() : null;
  if (rawStringSrc === '') {
    return null;
  }
  const declaredWidth = typeof props.width === 'number' ? props.width : null;
  const nextSrc =
    rawStringSrc
      ? resolveManagedImageUrl(rawStringSrc, role, declaredWidth)
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

  const merged = {
    ...roleDefaults[role],
    ...props,
    src: activeSrc,
    unoptimized: rawStringSrc ? isSvgSrc(rawStringSrc) || props.unoptimized === true : props.unoptimized,
    alt,
    onError: handleError,
  } as ImageProps;
  const { alt: mergedAlt, ...rest } = merged;

  return <Image {...rest} alt={typeof mergedAlt === 'string' ? mergedAlt : ''} />;
}
