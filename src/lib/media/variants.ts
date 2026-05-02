type VariantFormat = 'avif' | 'webp' | 'jpeg' | 'png';

export type ManagedImageRole = 'hero' | 'logo' | 'card' | 'content' | 'gallery' | 'avatar';

const ROLE_WIDTHS: Record<ManagedImageRole, number[]> = {
  hero: [768, 1200, 1600, 2000],
  logo: [160, 220, 320, 480],
  card: [480, 768, 1200],
  content: [768, 1200, 1600],
  gallery: [768, 1200, 1600, 2000],
  avatar: [160, 320, 640, 800],
};

const SOURCE_WIDTHS: number[][] = [
  [768, 1200, 1600, 2000], // hero
  [160, 220, 320, 480], // logo
  [32, 64, 128, 256], // icon
  [480, 768, 1200], // card
  [768, 1200, 1600], // content
  [768, 1200, 1600, 2000], // gallery
  [160, 320, 640, 800], // avatar
  [480, 768, 1200, 1600], // graphic/generic
];

const DEFAULT_TARGET_WIDTH: Record<ManagedImageRole, number> = {
  hero: 1600,
  logo: 320,
  card: 768,
  content: 1200,
  gallery: 1200,
  avatar: 320,
};

const MANAGED_VARIANT_FILE_RE = /^(.*)-(\d+)w\.(avif|webp|png|jpe?g)$/i;

function toUrlParts(url: string) {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    return {
      base: `${parsed.origin}${parsed.pathname}`,
      suffix: `${parsed.search}${parsed.hash}`,
    };
  } catch {
    const match = trimmed.match(/^([^?#]+)(.*)$/);
    if (!match) return null;
    return {
      base: match[1],
      suffix: match[2] ?? '',
    };
  }
}

function parseManagedVariantUrl(url: string) {
  const parts = toUrlParts(url);
  if (!parts) return null;

  const lastSlashIndex = parts.base.lastIndexOf('/');
  const directory = lastSlashIndex >= 0 ? parts.base.slice(0, lastSlashIndex + 1) : '';
  const fileName = lastSlashIndex >= 0 ? parts.base.slice(lastSlashIndex + 1) : parts.base;
  const match = fileName.match(MANAGED_VARIANT_FILE_RE);
  if (!match) return null;

  const [, baseName = '', widthValue = '', formatValue = ''] = match;
  const width = Number.parseInt(widthValue, 10);
  const format = formatValue.toLowerCase() as VariantFormat;
  if (!Number.isFinite(width) || width <= 0) return null;

  return {
    directory,
    baseName,
    width,
    format,
    suffix: parts.suffix,
  };
}

function chooseTargetVariantWidth(
  availableWidths: number[],
  sourceWidth: number,
  requestedWidth: number,
) {
  const eligible = availableWidths.filter((candidate) => candidate <= sourceWidth).sort((a, b) => a - b);
  if (eligible.length === 0) return sourceWidth;

  const atOrAboveTarget = eligible.find((candidate) => candidate >= requestedWidth);
  return atOrAboveTarget ?? eligible[eligible.length - 1] ?? sourceWidth;
}

function intersectWidthSets(sets: number[][]) {
  if (sets.length === 0) return [] as number[];
  return sets.slice(1).reduce<number[]>((shared, current) => shared.filter((value) => current.includes(value)), [...sets[0]]);
}

function getAvailableSiblingWidths(sourceWidth: number) {
  const matchingSets = SOURCE_WIDTHS.filter((set) => set.includes(sourceWidth));
  if (matchingSets.length === 0) return [sourceWidth];

  const sharedWidths = intersectWidthSets(matchingSets).filter((width) => width <= sourceWidth).sort((a, b) => a - b);
  return sharedWidths.length > 0 ? sharedWidths : [sourceWidth];
}

export function getManagedImageTargetWidth(role: ManagedImageRole, declaredWidth?: number | null) {
  if (typeof declaredWidth === 'number' && Number.isFinite(declaredWidth) && declaredWidth > 0) {
    return Math.min(DEFAULT_TARGET_WIDTH[role], Math.max(declaredWidth * 2, declaredWidth));
  }
  return DEFAULT_TARGET_WIDTH[role];
}

export function resolveManagedImageUrl(
  src: string,
  role: ManagedImageRole,
  declaredWidth?: number | null,
) {
  const parsed = parseManagedVariantUrl(src);
  if (!parsed) return src;

  const requestedWidth = getManagedImageTargetWidth(role, declaredWidth);
  if (parsed.width <= requestedWidth) return src;

  const targetWidth = chooseTargetVariantWidth(getAvailableSiblingWidths(parsed.width), parsed.width, requestedWidth);
  if (targetWidth >= parsed.width) return src;

  return `${parsed.directory}${parsed.baseName}-${targetWidth}w.${parsed.format}${parsed.suffix}`;
}
