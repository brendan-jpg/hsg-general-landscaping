import { useEffect, useMemo, useRef, useState } from 'react';
import MediaPickerField from '@/components/backend/MediaPickerField';
import type { MediaUsageReference } from '@/lib/media/queries';
import type { Tables } from '@/lib/types/database';

type Media = Tables<'media'>;

interface SeoFieldsProps {
  metaTitle?: string;
  metaDescription?: string;
  ogImageUrl?: string;
  mediaItems?: Media[];
  mediaUsageByUrl?: Record<string, MediaUsageReference[]>;
  onChange?: (field: string, value: string) => void;
  availableTags?: string[];
}

const baseDynamicTags = ['{{business}}', '{{city}}', '{{state}}', '{{state_code}}', '{{primary_area}}', '{{primary_service}}', '{{url}}', '{{site_url}}'] as const;
type FieldName = 'meta_title' | 'meta_description';

export default function SeoFields({
  metaTitle,
  metaDescription,
  ogImageUrl,
  mediaItems,
  mediaUsageByUrl,
  onChange,
  availableTags = [],
}: SeoFieldsProps) {
  const uniqueTags = useMemo(() => Array.from(new Set([...baseDynamicTags, ...availableTags])), [availableTags]);
  const [openMenu, setOpenMenu] = useState<FieldName | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const descriptionInputRef = useRef<HTMLTextAreaElement | null>(null);
  const titleMenuRef = useRef<HTMLDivElement | null>(null);
  const descriptionMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (openMenu === 'meta_title' && titleMenuRef.current && !titleMenuRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
      if (
        openMenu === 'meta_description' &&
        descriptionMenuRef.current &&
        !descriptionMenuRef.current.contains(event.target as Node)
      ) {
        setOpenMenu(null);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenu]);

  function insertTag(field: FieldName, tag: string) {
    const isTitle = field === 'meta_title';
    const input = isTitle ? titleInputRef.current : descriptionInputRef.current;
    const currentValue = isTitle ? (metaTitle || '') : (metaDescription || '');

    if (!input) {
      onChange?.(field, `${currentValue}${tag}`);
      setOpenMenu(null);
      return;
    }

    const start = input.selectionStart ?? currentValue.length;
    const end = input.selectionEnd ?? currentValue.length;
    const nextValue = `${currentValue.slice(0, start)}${tag}${currentValue.slice(end)}`;
    onChange?.(field, nextValue);
    setOpenMenu(null);

    requestAnimationFrame(() => {
      input.focus();
      const cursor = start + tag.length;
      input.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className="seo-fields">
      <div className="seo-fields__field">
        <div className="seo-fields__label-row">
          <label>Meta Title</label>
          <div className="seo-fields__token-menu" ref={titleMenuRef}>
            <button
              type="button"
              className="seo-fields__token-trigger"
              aria-label="Insert dynamic tag"
              onClick={() => setOpenMenu((current) => (current === 'meta_title' ? null : 'meta_title'))}
            >
              <BoltIcon />
            </button>
            {openMenu === 'meta_title' && (
              <div className="seo-fields__token-dropdown">
                {uniqueTags.map((tag) => (
                  <button
                    key={`title-${tag}`}
                    type="button"
                    className="seo-fields__token-option"
                    onClick={() => insertTag('meta_title', tag)}
                  >
                    <code>{tag}</code>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <input
          ref={titleInputRef}
          type="text"
          value={metaTitle || ''}
          onChange={e => onChange?.('meta_title', e.target.value)}
          placeholder="Page title for search engines"
        />
        <span className="seo-fields__hint">{(metaTitle || '').length}/60</span>
      </div>
      <div className="seo-fields__field">
        <div className="seo-fields__label-row">
          <label>Meta Description</label>
          <div className="seo-fields__token-menu" ref={descriptionMenuRef}>
            <button
              type="button"
              className="seo-fields__token-trigger"
              aria-label="Insert dynamic tag"
              onClick={() => setOpenMenu((current) => (current === 'meta_description' ? null : 'meta_description'))}
            >
              <BoltIcon />
            </button>
            {openMenu === 'meta_description' && (
              <div className="seo-fields__token-dropdown">
                {uniqueTags.map((tag) => (
                  <button
                    key={`description-${tag}`}
                    type="button"
                    className="seo-fields__token-option"
                    onClick={() => insertTag('meta_description', tag)}
                  >
                    <code>{tag}</code>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <textarea
          ref={descriptionInputRef}
          value={metaDescription || ''}
          onChange={e => onChange?.('meta_description', e.target.value)}
          placeholder="Brief description for search results"
          rows={3}
        />
        <span className="seo-fields__hint">{(metaDescription || '').length}/160</span>
      </div>
      {ogImageUrl !== undefined && (
        <MediaPickerField
          label="OG Image"
          value={ogImageUrl}
          onChange={(value) => onChange?.('og_image_url', value)}
          items={mediaItems}
          usageByUrl={mediaUsageByUrl}
          allowUpload
          maxUploadFiles={1}
        />
      )}
    </div>
  );
}

function BoltIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
