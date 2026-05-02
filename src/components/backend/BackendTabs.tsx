'use client';

import Link from 'next/link';

export interface BackendTabItem {
  label: string;
  value: string;
  href?: string;
  disabled?: boolean;
}

interface BackendTabsProps {
  items: BackendTabItem[];
  activeValue?: string;
  ariaLabel: string;
  className?: string;
  wrap?: boolean;
  onChange?: (value: string) => void;
}

export default function BackendTabs({
  items,
  activeValue,
  ariaLabel,
  className = '',
  wrap = false,
  onChange,
}: BackendTabsProps) {
  const rootClassName = ['module__tabs', wrap ? 'module__tabs--wrap' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClassName} role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const tabClassName = `module__tab ${activeValue === item.value ? 'module__tab--active' : ''}`;

        if (item.href) {
          return (
            <Link
              key={item.value}
              href={item.href}
              role="tab"
              aria-selected={activeValue === item.value}
              aria-disabled={item.disabled || undefined}
              className={tabClassName}
            >
              {item.label}
            </Link>
          );
        }

        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={activeValue === item.value}
            className={tabClassName}
            onClick={() => onChange?.(item.value)}
            disabled={item.disabled}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
