'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

interface DynamicTagTextInputProps {
  className?: string;
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  tags: string[];
  required?: boolean;
  type?: 'text' | 'url' | 'email' | 'tel';
}

export default function DynamicTagTextInput({
  className,
  name,
  label,
  defaultValue = '',
  placeholder,
  tags,
  required = false,
  type = 'text',
}: DynamicTagTextInputProps) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const uniqueTags = useMemo(() => Array.from(new Set(tags)), [tags]);

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

  function insertTag(tag: string) {
    const input = inputRef.current;
    if (!input) {
      setValue((current) => `${current}${tag}`);
      setOpen(false);
      return;
    }

    const start = input.selectionStart ?? value.length;
    const end = input.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${tag}${value.slice(end)}`;
    setValue(next);
    setOpen(false);

    requestAnimationFrame(() => {
      input.focus();
      const cursor = start + tag.length;
      input.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <label className={className}>
      <div className="seo-fields__label-row">
        <span>{label}</span>
        <div className="seo-fields__token-menu" ref={menuRef}>
          <button
            type="button"
            className="seo-fields__token-trigger"
            aria-label={`Insert dynamic tag into ${label}`}
            onClick={() => setOpen((current) => !current)}
          >
            <BoltIcon />
          </button>
          {open && (
            <div className="seo-fields__token-dropdown">
              {uniqueTags.map((tag) => (
                <button
                  key={`${name}-${tag}`}
                  type="button"
                  className="seo-fields__token-option"
                  onClick={() => insertTag(tag)}
                >
                  <code>{tag}</code>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <input
        ref={inputRef}
        name={name}
        type={type === 'url' ? 'text' : type}
        inputMode={type === 'url' ? 'url' : undefined}
        autoComplete={type === 'url' ? 'url' : undefined}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
      />
    </label>
  );
}

function BoltIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}
