'use client';

import { useEffect, useRef, useState } from 'react';

interface DynamicTagInsertMenuProps {
  tags: string[];
  compact?: boolean;
  ariaLabel?: string;
  onInsert: (tag: string) => void;
}

export default function DynamicTagInsertMenu({
  tags,
  compact = false,
  ariaLabel = 'Insert dynamic tag',
  onInsert,
}: DynamicTagInsertMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const uniqueTags = Array.from(new Set(tags)).filter(Boolean);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!open) return;
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (uniqueTags.length === 0) return null;

  return (
    <div className={`seo-fields__token-menu${compact ? ' seo-fields__token-menu--compact' : ''}`} ref={menuRef}>
      <button
        type="button"
        className={`seo-fields__token-trigger${compact ? ' seo-fields__token-trigger--compact' : ''}`}
        aria-label={ariaLabel}
        onPointerDown={(event) => event.preventDefault()}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setOpen((current) => !current)}
      >
        <BoltIcon />
      </button>
      {open ? (
        <div className="seo-fields__token-dropdown">
          {uniqueTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className="seo-fields__token-option"
              onPointerDown={(event) => event.preventDefault()}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onInsert(tag);
                setOpen(false);
              }}
            >
              <code>{tag}</code>
            </button>
          ))}
        </div>
      ) : null}
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
