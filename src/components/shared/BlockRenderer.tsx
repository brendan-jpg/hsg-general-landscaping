import type { JSX } from 'react';
import AppImage from '@/components/shared/AppImage';

interface Block {
  type: string;
  data: Record<string, unknown>;
}

interface RhythmImage {
  id: string;
  file_url: string;
  caption?: string | null;
}

interface BlockRendererProps {
  blocks: Block[];
  className?: string;
  rhythmImages?: RhythmImage[];
  enableImageRhythm?: boolean;
}

const RHYTHM_LAYOUTS = [
  'block-renderer__rhythm--left',
  'block-renderer__rhythm--right',
  'block-renderer__rhythm--full',
] as const;

function isRhythmAnchorBlock(block: Block) {
  return ['heading', 'paragraph', 'list', 'quote', 'html'].includes(block.type);
}

function buildRhythmPlan(blocks: Block[], rhythmImages: RhythmImage[], enabled: boolean) {
  const plan = new Map<number, { image: RhythmImage; layoutClass: string }>();
  if (!enabled) return plan;

  const dedupedImages = rhythmImages.filter((image, index, allImages) =>
    Boolean(image?.file_url) && allImages.findIndex((candidate) => candidate.file_url === image.file_url) === index,
  );
  if (dedupedImages.length === 0) return plan;

  const anchorIndexes = blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block, index }) => isRhythmAnchorBlock(block) && index < blocks.length - 1)
    .map(({ index }) => index);

  if (anchorIndexes.length < 3) return plan;

  const targetInsertions = Math.min(dedupedImages.length, Math.floor(anchorIndexes.length / 3), 3);
  for (let i = 0; i < targetInsertions; i += 1) {
    const anchorIndex = anchorIndexes[Math.min((i + 1) * 3 - 1, anchorIndexes.length - 2)];
    if (plan.has(anchorIndex)) continue;
    plan.set(anchorIndex, {
      image: dedupedImages[i],
      layoutClass: RHYTHM_LAYOUTS[i % RHYTHM_LAYOUTS.length],
    });
  }

  return plan;
}

function renderRhythmImage(
  image: RhythmImage,
  key: string,
  layoutClass: string,
) {
  return (
    <figure key={key} className={['block-renderer__rhythm', layoutClass].join(' ')}>
      <div className="block-renderer__rhythm-media">
        <AppImage
          role="content"
          src={image.file_url}
          alt={image.caption?.trim() || ''}
          width={1400}
          height={1050}
          className="block-renderer__rhythm-image"
        />
      </div>
    </figure>
  );
}

export default function BlockRenderer({ blocks, className, rhythmImages = [], enableImageRhythm = false }: BlockRendererProps) {
  const rhythmPlan = buildRhythmPlan(blocks, rhythmImages, enableImageRhythm);
  return (
    <div className={['block-renderer', 'container', className].filter(Boolean).join(' ')}>
      {blocks.flatMap((block, i) => {
        const rendered = [<RenderBlock key={`block-${i}`} block={block} />];
        const rhythmImage = rhythmPlan.get(i);
        if (rhythmImage) {
          rendered.push(renderRhythmImage(rhythmImage.image, `rhythm-${rhythmImage.image.id}-${i}`, rhythmImage.layoutClass));
        }
        return rendered;
      })}
    </div>
  );
}

function RenderBlock({ block }: { block: Block }) {
  const getString = (value: unknown) => (typeof value === 'string' ? value : '');
  const getNumber = (value: unknown, fallback = 0) =>
    typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  const getBoolean = (value: unknown) => value === true;

  switch (block.type) {
    case 'heading': {
      const headingLevel = Math.min(6, Math.max(1, getNumber(block.data.level, 2)));
      const HeadingTag = `h${headingLevel}` as keyof JSX.IntrinsicElements;
      return <HeadingTag>{getString(block.data.text)}</HeadingTag>;
    }

    case 'paragraph':
      return <p>{getString(block.data.text)}</p>;

    case 'image':
      return (
        <figure className="block-renderer__image">
          {/* <Image src={block.data.url} alt={block.data.alt} /> */}
        </figure>
      );

    case 'cta': {
      const style = getString(block.data.style) || 'primary';
      return (
        <div className="block-renderer__cta">
          <a href={getString(block.data.url)} className={`btn btn--${style}`}>
            {getString(block.data.text)}
          </a>
        </div>
      );
    }

    case 'list': {
      const ListTag = getBoolean(block.data.ordered) ? 'ol' : 'ul';
      const items = Array.isArray(block.data.items)
        ? block.data.items.filter((item): item is string => typeof item === 'string')
        : [];
      const listVariantClass = getBoolean(block.data.ordered)
        ? 'block-renderer__list--ordered'
        : 'block-renderer__list--unordered';

      return (
        <ListTag className={['block-renderer__list', listVariantClass].join(' ')}>
          {items.map((item, i) => <li key={i} className="block-renderer__list-item">{item}</li>)}
        </ListTag>
      );
    }

    case 'quote':
      return (
        <blockquote className="block-renderer__quote">
          <p>{getString(block.data.text)}</p>
          {typeof block.data.attribution === 'string' && <cite>{block.data.attribution}</cite>}
        </blockquote>
      );

    case 'video':
      return (
        <div className="block-renderer__video">
          {/* Embed iframe or video element */}
        </div>
      );

    case 'html':
      return <div dangerouslySetInnerHTML={{ __html: getString(block.data.html) }} />;

    default:
      return null;
  }
}
