'use client';

import Link from 'next/link';
import CodeMirror from '@uiw/react-codemirror';
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete';
import { css as cssLanguage } from '@codemirror/lang-css';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorSelection } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { keymap } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { useActionState, useEffect, useMemo, useState } from 'react';
import PendingSubmitButton from '@/components/backend/PendingSubmitButton';
import {
  assembleThemeEditorSections,
  splitThemeEditorSource,
  THEME_EDITOR_SECTION_LABELS,
  THEME_EDITOR_SECTION_ORDER,
  type ThemeEditorSectionKey,
  type ThemeEditorSections,
} from '@/lib/frontend/themeEditorSections';

type ThemeCssEditorActionState = {
  error: string | null;
  success: string | null;
};

type ThemeCssEditorProps = {
  action: (
    previousState: ThemeCssEditorActionState,
    formData: FormData,
  ) => ThemeCssEditorActionState | Promise<ThemeCssEditorActionState>;
  businessId: string;
  themeKey: string;
  initialCss: string;
  baseCss: string;
  isUsingStoredCopy: boolean;
  backHref?: string | null;
  siteHref?: string | null;
};

function formatStatusLabel(isUsingStoredCopy: boolean, isDirty: boolean) {
  if (isDirty) return 'Unsaved changes';
  return isUsingStoredCopy ? 'DB theme source active' : 'Starter theme loaded';
}

const themeEditorHighlightStyle = HighlightStyle.define([
  { tag: tags.comment, color: '#6b7280', fontStyle: 'italic' },
  { tag: [tags.propertyName, tags.attributeName], color: '#7dd3fc' },
  { tag: [tags.keyword, tags.operatorKeyword, tags.unit], color: '#c4b5fd' },
  { tag: [tags.color, tags.number, tags.bool, tags.atom], color: '#f59e0b' },
  { tag: [tags.string, tags.url], color: '#86efac' },
  { tag: [tags.className, tags.labelName, tags.typeName], color: '#f472b6' },
  { tag: [tags.punctuation, tags.brace, tags.squareBracket, tags.paren], color: '#cbd5e1' },
]);

const cssBlockBraceKeymap = keymap.of([
  {
    key: '{',
    run(view) {
      const selection = view.state.selection.main;
      if (!selection.empty) return false;

      const line = view.state.doc.lineAt(selection.head);
      const currentIndent = (line.text.match(/^\s*/) || [''])[0];
      const nestedIndent = `${currentIndent}  `;
      const blockText = `{\n${nestedIndent}\n${currentIndent}}`;
      const insertFrom = selection.from;
      const cursorPosition = insertFrom + 2 + nestedIndent.length;

      view.dispatch({
        changes: { from: insertFrom, to: selection.to, insert: blockText },
        selection: EditorSelection.cursor(cursorPosition),
      });

      return true;
    },
  },
]);

export default function ThemeCssEditor({
  action,
  businessId,
  themeKey,
  initialCss,
  baseCss,
  isUsingStoredCopy,
  backHref = null,
  siteHref = null,
}: ThemeCssEditorProps) {
  const [activeSection, setActiveSection] = useState<ThemeEditorSectionKey>('variables');
  const [sections, setSections] = useState<ThemeEditorSections>(() => splitThemeEditorSource(initialCss));
  const [savedSections, setSavedSections] = useState<ThemeEditorSections>(() => splitThemeEditorSource(initialCss));
  const [selection, setSelection] = useState({ line: 1, column: 1 });
  const [saveState, submitAction] = useActionState(action, { error: null, success: null });

  useEffect(() => {
    const nextSections = splitThemeEditorSource(initialCss);
    setSections(nextSections);
    setSavedSections(nextSections);
    setActiveSection('variables');
  }, [initialCss]);

  useEffect(() => {
    if (!saveState.error && saveState.success) {
      setSavedSections(sections);
    }
  }, [saveState.error, saveState.success, sections]);

  const css = sections[activeSection] ?? '';
  const activeSectionLabel = THEME_EDITOR_SECTION_LABELS[activeSection];
  const isDirty = useMemo(
    () => assembleThemeEditorSections(sections) !== assembleThemeEditorSections(savedSections),
    [savedSections, sections],
  );
  const fullCss = useMemo(() => assembleThemeEditorSections(sections), [sections]);
  const lineCount = useMemo(() => Math.max(1, css.split('\n').length), [css]);
  const extensions = useMemo(
    () => [
      cssLanguage(),
      closeBrackets(),
      syntaxHighlighting(themeEditorHighlightStyle),
      cssBlockBraceKeymap,
      keymap.of(closeBracketsKeymap),
    ],
    [],
  );

  function restoreBaseTheme() {
    setSections(splitThemeEditorSource(baseCss));
  }

  function restoreOpenedVersion() {
    setSections(savedSections);
  }

  function updateSectionValue(section: ThemeEditorSectionKey, value: string) {
    setSections((currentSections) => ({
      ...currentSections,
      [section]: value,
    }));
  }

  return (
    <form action={submitAction} className="platform-theme-workbench">
      <input type="hidden" name="business_id" value={businessId} />
      <input type="hidden" name="theme" value={themeKey} />
      <input type="hidden" name="css" value={fullCss} />
      <div className="platform-theme-workbench__window">
        <aside className="platform-theme-workbench__sidebar" aria-label="Theme file overview">
          <div className="platform-theme-workbench__sidebar-title">Explorer</div>
          <div className="platform-theme-workbench__file platform-theme-workbench__file--active">
            <strong>{themeKey}.css</strong>
            <span>businesses.theme_css</span>
          </div>
          <div className="platform-theme-workbench__section-list" role="tablist" aria-label="Theme sections">
            {THEME_EDITOR_SECTION_ORDER.map((sectionKey) => {
              const sectionValue = sections[sectionKey] ?? '';
              const sectionLines = sectionValue ? Math.max(1, sectionValue.split('\n').length) : 0;
              const isSectionActive = sectionKey === activeSection;
              return (
                <button
                  key={sectionKey}
                  type="button"
                  role="tab"
                  aria-selected={isSectionActive}
                  className={[
                    'platform-theme-workbench__section-button',
                    isSectionActive ? 'platform-theme-workbench__section-button--active' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => setActiveSection(sectionKey)}
                >
                  <strong>{THEME_EDITOR_SECTION_LABELS[sectionKey]}</strong>
                  <span>{sectionLines} lines</span>
                </button>
              );
            })}
          </div>
          <p className="platform-theme-workbench__sidebar-note">
            Saving rewrites the theme file into these four sections.
          </p>
        </aside>

        <div className="platform-theme-workbench__editor-shell">
          <div className="platform-theme-workbench__topbar">
            <div className="platform-theme-workbench__topbar-main">
              <div className="platform-theme-workbench__tab platform-theme-workbench__tab--active">
                {activeSectionLabel}
              </div>
              <div className="platform-theme-workbench__topbar-meta">
                <span>{formatStatusLabel(isUsingStoredCopy, isDirty)}</span>
                <span>{themeKey}.css</span>
              </div>
            </div>
            <div className="platform-theme-workbench__actions platform-theme-workbench__actions--topbar">
              {backHref ? (
                <Link className="btn btn--ghost btn--sm" href={backHref}>
                  Back
                </Link>
              ) : null}
              {siteHref ? (
                <Link className="btn btn--ghost btn--sm" href={siteHref} target="_blank">
                  Site
                </Link>
              ) : null}
              <button type="button" className="btn btn--secondary btn--sm" onClick={restoreBaseTheme}>
                Reset
              </button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={restoreOpenedVersion} disabled={!isDirty}>
                Restore
              </button>
              <PendingSubmitButton
                idleLabel="Save"
                pendingLabel="Saving..."
                className="btn btn--secondary btn--sm"
              />
            </div>
          </div>
          {saveState.error ? (
            <div className="platform-theme-workbench__notice platform-theme-workbench__notice--error" role="alert">
              {saveState.error}
            </div>
          ) : null}
          {!saveState.error && saveState.success ? (
            <div className="platform-theme-workbench__notice platform-theme-workbench__notice--success" role="status">
              {saveState.success}
            </div>
          ) : null}
          <div className="platform-theme-workbench__editor platform-theme-workbench__editor--codemirror">
            <CodeMirror
              value={css}
              height="100%"
              theme={oneDark}
              extensions={extensions}
              basicSetup={{
                lineNumbers: true,
                foldGutter: false,
                dropCursor: false,
                allowMultipleSelections: false,
                indentOnInput: true,
                bracketMatching: true,
                closeBrackets: false,
                autocompletion: false,
                highlightSelectionMatches: false,
              }}
              onChange={(value) => updateSectionValue(activeSection, value)}
              onUpdate={(update) => {
                const selectionHead = update.state.selection.main.head;
                const line = update.state.doc.lineAt(selectionHead);
                setSelection({
                  line: line.number,
                  column: selectionHead - line.from + 1,
                });
              }}
            />
          </div>
          <div className="platform-theme-workbench__statusbar">
            <span>CSS</span>
            <span>{activeSectionLabel}</span>
            <span>Ln {selection.line}, Col {selection.column}</span>
            <span>{lineCount} lines</span>
            <span>{css.length.toLocaleString()} chars</span>
            <span>{fullCss.length.toLocaleString()} total</span>
          </div>
        </div>
      </div>
    </form>
  );
}
