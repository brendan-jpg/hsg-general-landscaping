import BackendTabs from '@/components/backend/BackendTabs';

interface Tab {
  label: string;
  value: string;
}

interface ModuleShellProps {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  toolbar?: React.ReactNode;
  footer?: React.ReactNode;
  tabs?: Tab[];
  activeTab?: string;
  onTabChange?: (value: string) => void;
  children: React.ReactNode;
}

export default function ModuleShell({
  title,
  actions,
  toolbar,
  footer,
  tabs,
  activeTab,
  onTabChange,
  children,
}: ModuleShellProps) {
  const hasHeaderControls = Boolean(toolbar || actions);

  return (
    <div className="module">
      {hasHeaderControls && (
        <div className="module__header">
          {toolbar ? (
            <div className="module__toolbar">
              <div className="module__toolbar-main">{toolbar}</div>
              {actions && <div className="module__actions">{actions}</div>}
            </div>
          ) : (
            <div className="module__header-top">
              <div className="module__spacer" />
              {actions && <div className="module__actions">{actions}</div>}
            </div>
          )}
        </div>
      )}

      {tabs && tabs.length > 0 && (
        <BackendTabs
          items={tabs}
          activeValue={activeTab}
          ariaLabel={`${title ?? 'Module'} tabs`}
          onChange={onTabChange}
        />
      )}

      <div className="module__content">
        {children}
      </div>

      {footer && <div className="module__footer">{footer}</div>}
    </div>
  );
}
