'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppImage from '@/components/shared/AppImage';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  showUnreadDot?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navigation: NavGroup[] = [
  {
    title: 'Operations',
    items: [
      { label: 'Schedule', href: '/dashboard/schedule', icon: <ScheduleIcon /> },
      { label: 'Jobs', href: '/dashboard/jobs', icon: <JobsIcon /> },
      { label: 'Team', href: '/dashboard/team', icon: <TeamIcon /> },
    ],
  },
  {
    title: 'Sales',
    items: [
      { label: 'Leads', href: '/dashboard/leads', icon: <LeadsIcon /> },
      { label: 'Prospects', href: '/dashboard/prospects', icon: <ProspectsIcon /> },
      { label: 'Customers', href: '/dashboard/customers', icon: <CustomersIcon /> },
      { label: 'Estimates', href: '/dashboard/estimates', icon: <EstimatesIcon /> },
      { label: 'Invoices', href: '/dashboard/invoices', icon: <InvoicesIcon /> },
    ],
  },
  {
    title: 'Marketing',
    items: [
      { label: 'Pages', href: '/dashboard/pages', icon: <PagesIcon /> },
      { label: 'Content', href: '/dashboard/content', icon: <BlogIcon /> },
      { label: 'Services', href: '/dashboard/services', icon: <ServicesIcon /> },
      { label: 'Areas', href: '/dashboard/areas', icon: <AreasIcon /> },
      { label: 'FAQs', href: '/dashboard/faqs', icon: <FaqsIcon /> },
      { label: 'Testimonials', href: '/dashboard/testimonials', icon: <TestimonialsIcon /> },
      { label: 'Forms', href: '/dashboard/forms', icon: <FormsIcon /> },
      { label: 'Media', href: '/dashboard/media', icon: <MediaIcon /> },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Communication', href: '/dashboard/automations', icon: <AutomationsIcon /> },
    ],
  },
];

interface AppSideProps {
  isOpen: boolean;
  onToggle: () => void;
  userRole?: 'admin' | 'employee';
  isPlatformAdmin?: boolean;
  businessName?: string;
  businessFaviconUrl?: string | null;
  unreadLeadCount?: number;
}

export default function AppSide({
  isOpen,
  onToggle,
  userRole = 'employee',
  isPlatformAdmin = false,
  businessName = 'Dashboard',
  businessFaviconUrl = null,
  unreadLeadCount = 0,
}: AppSideProps) {
  const pathname = usePathname();
  const normalizedBusinessFaviconUrl = businessFaviconUrl?.trim() || null;
  const isLeadListOpen = pathname === '/dashboard/leads' || pathname.startsWith('/dashboard/leads?');
  const baseNavigation = navigation.filter((group) => {
    if (userRole === 'admin') return true;
    return group.title !== 'Marketing' && group.title !== 'System';
  });
  const visibleNavigation = baseNavigation.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      showUnreadDot: item.href === '/dashboard/leads' && unreadLeadCount > 0 && !isLeadListOpen,
    })),
  }));

  return (
    <aside className={`sidebar ${isOpen ? '' : 'sidebar--collapsed'}`}>
      <div className="sidebar__header">
        <Link href="/dashboard" className="sidebar__logo">
          {isOpen ? (
            <>
              {normalizedBusinessFaviconUrl ? (
                <AppImage className="sidebar__favicon" role="logo" src={normalizedBusinessFaviconUrl} alt="" aria-hidden="true" width={32} height={32} />
              ) : null}
              <span>{businessName}</span>
            </>
          ) : (
            <span>{businessName.trim().charAt(0).toUpperCase() || 'D'}</span>
          )}
        </Link>
        <button
          className="sidebar__collapse-btn"
          onClick={onToggle}
          aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <ChevronIcon direction={isOpen ? 'left' : 'right'} />
        </button>
      </div>

      <nav className="sidebar__nav">
        {visibleNavigation.map((group) => (
          <div
            key={group.title}
            className="sidebar__group"
            style={
              {
                '--sidebar-group-weight': group.items.length,
              } as React.CSSProperties
            }
          >
            {isOpen && group.title ? <span className="sidebar__group-title">{group.title}</span> : null}
            <ul className="sidebar__list">
              {group.items.map((item) => {
                const isActive =
                  (item.href === '/dashboard/customers' && pathname.startsWith('/dashboard/contacts'))
                    ? true
                    : item.href === '/dashboard'
                    ? pathname === '/dashboard'
                    : pathname.startsWith(item.href);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`sidebar__link ${isActive ? 'sidebar__link--active' : ''}`}
                      title={isOpen ? undefined : item.label}
                    >
                      <span className="sidebar__icon">{item.icon}</span>
                      {isOpen ? <span className="sidebar__label">{item.label}</span> : null}
                      {item.showUnreadDot ? <span className="sidebar__notif-dot" aria-hidden="true" /> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

/* Placeholder icons — replace with your icon library */
function ScheduleIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/><path d="M8 14h3"/><path d="M13 14h3"/><path d="M8 18h3"/></svg>; }
function JobsIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>; }
function EstimatesIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>; }
function InvoicesIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>; }
function StageStepsIcon({ count }: { count: 1 | 2 | 3 }) {
  const steps = [
    { x: 3, y: 13, width: 4, height: 7 },
    { x: 10, y: 9, width: 4, height: 11 },
    { x: 17, y: 5, width: 4, height: 15 },
  ];
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {steps.map((step, index) => (
        <rect
          key={`${step.x}-${step.y}`}
          x={step.x}
          y={step.y}
          width={step.width}
          height={step.height}
          rx="1.25"
          fill={index < count ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.5"
        />
      ))}
    </svg>
  );
}
function LeadsIcon() { return <StageStepsIcon count={1} />; }
function ProspectsIcon() { return <StageStepsIcon count={2} />; }
function CustomersIcon() { return <StageStepsIcon count={3} />; }
function PagesIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>; }
function BlogIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>; }
function TeamIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6"/><path d="M23 11h-6"/></svg>; }
function ServicesIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>; }
function AreasIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>; }
function FaqsIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 1 1 5.8 1c-.4 1.1-1.6 1.5-2.3 2.2-.5.5-.6.8-.6 1.8"/><circle cx="12" cy="17" r="1"/></svg>; }
function TestimonialsIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>; }
function FormsIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>; }
function MediaIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 15v4c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>; }
function AutomationsIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>; }
function ChevronIcon({ direction }: { direction: 'left' | 'right' }) { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: direction === 'right' ? 'rotate(180deg)' : undefined }}><polyline points="15 18 9 12 15 6"/></svg>; }
