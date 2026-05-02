'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import NotificationBell from '@/components/backend/notifications/NotificationBell';
import type { DashboardLeadNotification } from '@/lib/notifications/queries';

interface TopbarProps {
  userInitials: string;
  isPlatformAdmin?: boolean;
  leadNotifications: DashboardLeadNotification[];
  unreadLeadCount: number;
}

const PRIMARY_NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Analytics', href: '/dashboard/analytics' },
] as const;

type EditorNavTable =
  | 'pages'
  | 'services'
  | 'areas'
  | 'blog_posts'
  | 'invoices'
  | 'contacts'
  | 'jobs'
  | 'estimates'
  | 'team_members'
  | 'testimonials'
  | 'faqs'
  | 'forms'
  | 'schedule_items'
  | 'email_templates';

interface EditorResourceConfig {
  table: EditorNavTable;
  listPath: string;
  buildDetailPath: (id: string) => string;
  contactStatus?: 'lead' | 'prospect' | 'customer';
  contentTypeId?: string;
}

const EDITOR_RESOURCE_BY_PATH: Record<string, EditorResourceConfig> = {
  pages: {
    table: 'pages',
    listPath: '/dashboard/pages',
    buildDetailPath: (id) => `/dashboard/pages/${id}`,
  },
  services: {
    table: 'services',
    listPath: '/dashboard/services',
    buildDetailPath: (id) => `/dashboard/services/${id}`,
  },
  'areas': {
    table: 'areas',
    listPath: '/dashboard/areas',
    buildDetailPath: (id) => `/dashboard/areas/${id}`,
  },
  blog: {
    table: 'blog_posts',
    listPath: '/dashboard/content?tab=blogs',
    buildDetailPath: (id) => `/dashboard/blog/${id}`,
  },
  invoices: {
    table: 'invoices',
    listPath: '/dashboard/invoices',
    buildDetailPath: (id) => `/dashboard/invoices/${id}`,
  },
  contacts: {
    table: 'contacts',
    listPath: '/dashboard/contacts',
    buildDetailPath: (id) => `/dashboard/contacts/${id}`,
  },
  leads: {
    table: 'contacts',
    listPath: '/dashboard/leads',
    buildDetailPath: (id) => `/dashboard/leads/${id}`,
    contactStatus: 'lead',
  },
  prospects: {
    table: 'contacts',
    listPath: '/dashboard/prospects',
    buildDetailPath: (id) => `/dashboard/prospects/${id}`,
    contactStatus: 'prospect',
  },
  customers: {
    table: 'contacts',
    listPath: '/dashboard/customers',
    buildDetailPath: (id) => `/dashboard/customers/${id}`,
    contactStatus: 'customer',
  },
  jobs: {
    table: 'jobs',
    listPath: '/dashboard/jobs',
    buildDetailPath: (id) => `/dashboard/jobs/${id}`,
  },
  estimates: {
    table: 'estimates',
    listPath: '/dashboard/estimates',
    buildDetailPath: (id) => `/dashboard/estimates/${id}`,
  },
  team: {
    table: 'team_members',
    listPath: '/dashboard/team',
    buildDetailPath: (id) => `/dashboard/team/${id}`,
  },
  testimonials: {
    table: 'testimonials',
    listPath: '/dashboard/testimonials',
    buildDetailPath: (id) => `/dashboard/testimonials/${id}`,
  },
  faqs: {
    table: 'faqs',
    listPath: '/dashboard/faqs',
    buildDetailPath: (id) => `/dashboard/faqs/${id}`,
  },
  forms: {
    table: 'forms',
    listPath: '/dashboard/forms',
    buildDetailPath: (id) => `/dashboard/forms/${id}`,
  },
  schedule: {
    table: 'schedule_items',
    listPath: '/dashboard/schedule',
    buildDetailPath: (id) => `/dashboard/schedule/${id}`,
  },
};

const AUTOMATION_TEMPLATE_RESOURCE: EditorResourceConfig = {
  table: 'email_templates',
  listPath: '/dashboard/automations',
  buildDetailPath: (id) => `/dashboard/automations/templates/${id}`,
};

function getEditorContext(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] !== 'dashboard') return null;
  if (segments[1] === 'automations' && segments[2] === 'templates' && segments[3]) {
    return { id: segments[3], resource: AUTOMATION_TEMPLATE_RESOURCE };
  }
  if (
    segments[1] === 'content' &&
    segments[2] === 'types' &&
    segments[3] &&
    segments[4] === 'entries' &&
    segments[5]
  ) {
    return null;
  }
  if (segments[1] === 'schedule' && segments[2] === 'day') return null;
  if (!segments[1] || !segments[2]) return null;
  const resource = EDITOR_RESOURCE_BY_PATH[segments[1]];
  if (!resource) return null;
  return { id: segments[2], resource };
}

function getScheduleDayContext(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] !== 'dashboard' || segments[1] !== 'schedule' || segments[2] !== 'day' || !segments[3]) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(segments[3])) return null;
  return { date: segments[3] };
}

function shiftIsoDay(day: string, delta: number) {
  const [year, month, date] = day.split('-').map(Number);
  const next = new Date(year, (month || 1) - 1, date || 1);
  if (Number.isNaN(next.getTime())) return day;
  next.setDate(next.getDate() + delta);
  const nextYear = next.getFullYear();
  const nextMonth = `${next.getMonth() + 1}`.padStart(2, '0');
  const nextDate = `${next.getDate()}`.padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDate}`;
}

function toDashboardPageTitle(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] !== 'dashboard') return 'Dashboard';
  if (segments.length === 1) return 'Dashboard';

  const primary = segments[1];
  const labels: Record<string, string> = {
    analytics: 'Analytics',
    automations: 'Communication',
    customers: 'Customers',
    blog: 'Blog',
    content: 'Content',
    contacts: 'Contacts',
    dashboard: 'Dashboard',
    estimates: 'Estimates',
    faqs: 'FAQs',
    invoices: 'Invoices',
    jobs: 'Jobs',
    leads: 'Leads',
    media: 'Media',
    pages: 'Pages',
    prospects: 'Prospects',
    schedule: 'Schedule',
    services: 'Services',
    'areas': 'Areas',
    settings: 'Settings',
    team: 'Team',
    testimonials: 'Testimonials',
  };

  if (labels[primary]) return labels[primary];
  return primary
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function Topbar({
  userInitials,
  isPlatformAdmin = false,
  leadNotifications,
  unreadLeadCount,
}: TopbarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const router = useRouter();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [leftHref, setLeftHref] = useState<string | null>(null);
  const [rightHref, setRightHref] = useState<string | null>(null);
  const [listHref, setListHref] = useState<string | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const pageTitle = toDashboardPageTitle(pathname);
  const primaryNavItems = isPlatformAdmin
    ? [
        { label: 'Platform', href: '/dashboard/platform' },
        PRIMARY_NAV_ITEMS[0],
        PRIMARY_NAV_ITEMS[1],
      ]
    : PRIMARY_NAV_ITEMS;

  useEffect(() => {
    let isActive = true;

    async function loadSiblingNavigation() {
      const dayContext = getScheduleDayContext(pathname);
      if (dayContext) {
        if (!isActive) return;
        setLeftHref(`/dashboard/schedule/day/${shiftIsoDay(dayContext.date, -1)}`);
        setRightHref(`/dashboard/schedule/day/${shiftIsoDay(dayContext.date, 1)}`);
        setListHref(`/dashboard/schedule?month=${dayContext.date.slice(0, 7)}`);
        return;
      }

      const context = getEditorContext(pathname);
      if (!context || context.id === 'new') {
        if (!isActive) return;
        setLeftHref(null);
        setRightHref(null);
        setListHref(context?.resource.listPath ?? null);
        return;
      }

      try {
        const supabase = createClient();
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError) throw new Error(authError.message);
        if (!user) throw new Error('Not authenticated');

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('business_id')
          .eq('id', user.id)
          .maybeSingle();
        if (profileError) throw new Error(profileError.message);
        if (!profile?.business_id) throw new Error('No business context');

        const isScheduleResource = context.resource.table === 'schedule_items';

        if (isScheduleResource) {
          const { data: rows, error: rowsError } = await supabase
            .from('schedule_items')
            .select('id, starts_at')
            .eq('business_id', profile.business_id)
            .order('starts_at', { ascending: true, nullsFirst: false })
            .order('id', { ascending: true });
          if (rowsError) throw new Error(rowsError.message);

          const allIds = (rows ?? []).map((row) => row.id).filter(Boolean);
          const currentIndex = allIds.indexOf(context.id);
          const prevId = currentIndex > 0 ? allIds[currentIndex - 1] : null;
          const nextId = currentIndex >= 0 && currentIndex < allIds.length - 1 ? allIds[currentIndex + 1] : null;
          const currentRow = (rows ?? [])[currentIndex];
          const scheduleMonth =
            currentRow?.starts_at && !Number.isNaN(new Date(currentRow.starts_at).getTime())
              ? `${new Date(currentRow.starts_at).getFullYear()}-${`${new Date(currentRow.starts_at).getMonth() + 1}`.padStart(2, '0')}`
              : null;

          if (!isActive) return;
          setLeftHref(prevId ? context.resource.buildDetailPath(prevId) : null);
          setRightHref(nextId ? context.resource.buildDetailPath(nextId) : null);
          setListHref(
            scheduleMonth ? `${context.resource.listPath}?month=${scheduleMonth}` : context.resource.listPath
          );
          return;
        }

        const { data: rows, error: rowsError } = await supabase
          .from(context.resource.table)
          .select('id, created_at')
          .eq('business_id', profile.business_id)
          .order('created_at', { ascending: false })
          .order('id', { ascending: true });
        if (context.resource.table === 'contacts' && context.resource.contactStatus) {
          const { data: filteredRows, error: filteredRowsError } = await supabase
            .from('contacts')
            .select('id, created_at')
            .eq('business_id', profile.business_id)
            .eq('status', context.resource.contactStatus)
            .order('created_at', { ascending: false })
            .order('id', { ascending: true });
          if (filteredRowsError) throw new Error(filteredRowsError.message);

          const allIds = (filteredRows ?? []).map((row) => row.id).filter(Boolean);
          const currentIndex = allIds.indexOf(context.id);
          const prevId = currentIndex > 0 ? allIds[currentIndex - 1] : null;
          const nextId = currentIndex >= 0 && currentIndex < allIds.length - 1 ? allIds[currentIndex + 1] : null;

          if (!isActive) return;
          setLeftHref(prevId ? context.resource.buildDetailPath(prevId) : null);
          setRightHref(nextId ? context.resource.buildDetailPath(nextId) : null);
          setListHref(context.resource.listPath);
          return;
        }
        if (rowsError) throw new Error(rowsError.message);

        const allIds = (rows ?? []).map((row) => row.id).filter(Boolean);
        const currentIndex = allIds.indexOf(context.id);
        const prevId = currentIndex > 0 ? allIds[currentIndex - 1] : null;
        const nextId = currentIndex >= 0 && currentIndex < allIds.length - 1 ? allIds[currentIndex + 1] : null;

        if (!isActive) return;
        setLeftHref(prevId ? context.resource.buildDetailPath(prevId) : null);
        setRightHref(nextId ? context.resource.buildDetailPath(nextId) : null);
        setListHref(context.resource.listPath);
      } catch {
        if (!isActive) return;
        setLeftHref(null);
        setRightHref(null);
        if (context.resource.table === 'schedule_items') {
          const parsedSearchParams = new URLSearchParams(searchParamsKey);
          const month = parsedSearchParams.get('date')?.slice(0, 7) ?? parsedSearchParams.get('month');
          setListHref(month ? `${context.resource.listPath}?month=${month}` : context.resource.listPath);
        } else {
          setListHref(context.resource.listPath);
        }
      }
    }

    void loadSiblingNavigation();
    return () => {
      isActive = false;
    };
  }, [pathname, searchParamsKey]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setUserMenuOpen(false);

    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      router.replace('/');
      router.refresh();
    }
  }

  return (
    <header className="topbar">
      <div className="topbar__left">
        <nav className="topbar__primary-nav" aria-label="Primary dashboard">
          {primaryNavItems.map((item) => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : item.href === '/dashboard/customers'
                ? pathname.startsWith('/dashboard/customers') || pathname.startsWith('/dashboard/contacts')
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`topbar__nav-link ${isActive ? 'topbar__nav-link--active' : ''}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        {(leftHref || rightHref || listHref) && (
          <div className="topbar__pager" aria-label="Record navigation">
            <button
              type="button"
              className="topbar__pager-btn"
              onClick={() => leftHref && router.push(leftHref)}
              disabled={!leftHref}
              title="Previous in list"
              aria-label="Previous in list"
            >
              <ArrowIcon direction="left" />
            </button>
            {listHref && (
              <button
                type="button"
                className="topbar__pager-btn"
                onClick={() => router.push(listHref)}
                title="Back to list"
                aria-label="Back to list"
              >
                <ListIcon />
              </button>
            )}
            <button
              type="button"
              className="topbar__pager-btn"
              onClick={() => rightHref && router.push(rightHref)}
              disabled={!rightHref}
              title="Next in list"
              aria-label="Next in list"
            >
              <ArrowIcon direction="right" />
            </button>
          </div>
        )}
      </div>

      <div className="topbar__right">
        <div className="topbar__context" aria-label="Current section">
          <span className="topbar__business-name">{pageTitle}</span>
        </div>
        <NotificationBell initialNotifications={leadNotifications} initialUnreadCount={unreadLeadCount} />
        <Link href="/dashboard/settings" className="topbar__icon-link" aria-label="Settings" title="Settings">
          <SettingsIcon />
        </Link>
        <div className="topbar__user-menu" ref={userMenuRef}>
          <button
            className="topbar__user-btn"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            aria-expanded={userMenuOpen}
          >
            <span className="topbar__user-avatar" />
            <span className="topbar__user-initials">{userInitials}</span>
          </button>

          {userMenuOpen && (
            <div className="topbar__dropdown">
              <button className="topbar__dropdown-item" onClick={handleSignOut} disabled={isSigningOut}>
                {isSigningOut ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function ArrowIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ transform: direction === 'right' ? 'rotate(180deg)' : undefined }}
    >
      <path d="M19 12H6" />
      <path d="M12 6l-6 6 6 6" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 6h11" />
      <path d="M9 12h11" />
      <path d="M9 18h11" />
      <path d="M4 6h.01" />
      <path d="M4 12h.01" />
      <path d="M4 18h.01" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
