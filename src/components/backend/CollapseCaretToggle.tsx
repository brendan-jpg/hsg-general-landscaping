import type { MouseEventHandler } from 'react';

interface CollapseCaretToggleProps {
  collapsed: boolean;
  onClick: MouseEventHandler<HTMLButtonElement>;
  expandedLabel: string;
  collapsedLabel: string;
}

export default function CollapseCaretToggle({
  collapsed,
  onClick,
  expandedLabel,
  collapsedLabel,
}: CollapseCaretToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={!collapsed}
      aria-label={collapsed ? collapsedLabel : expandedLabel}
      title={collapsed ? 'Expand' : 'Collapse'}
      className={
        collapsed
          ? 'media-picker__icon-btn editor-collapse-toggle editor-collapse-toggle--collapsed'
          : 'media-picker__icon-btn editor-collapse-toggle'
      }
    >
      <span aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </span>
    </button>
  );
}
