import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AppShell from '@/components/backend/shell/AppShell';
import { getCurrentDashboardProfile, isPlatformAdminEmail, isPlatformHostRequest, normalizeDashboardRole } from '@/lib/authz/dashboard';
import { getDashboardLeadNotifications } from '@/lib/notifications/queries';
import { getBusinessBrandAssetUrls } from '@/lib/utils/business';
import '@/styles/backend/shell/app-shell.css';
import '@/styles/backend/shell/app-side.css';
import '@/styles/backend/shell/topbar.css';
import '@/styles/backend/shell/module-shell.css';
import '@/styles/backend/components/components.css';
import '@/styles/backend/components/editor.css';
import '@/styles/backend/pages/pages.css';

export const metadata = {
  title: {
    template: '%s | Dashboard',
    default: 'Dashboard',
  },
};

const backendSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-backend-sans',
  display: 'swap',
});

const backendLabel = Inter({
  subsets: ['latin'],
  variable: '--font-backend-label',
  display: 'swap',
});

export default async function BackendLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentDashboardProfile();
  const user = profile?.user ?? null;

  if (!user) {
    redirect('/login');
  }

  let businessName = 'Dashboard';
  let businessFaviconUrl: string | null = null;
  let userInitials = getInitials({ email: user.email ?? '' });
  const isPlatformAdmin = isPlatformAdminEmail(user.email) && (await isPlatformHostRequest());
  const leadNotifications = await getDashboardLeadNotifications();
  const supabase = await createClient();

  let userRole: 'admin' | 'employee' = 'employee';

  if (profile) {
    userRole = normalizeDashboardRole(profile.role as 'owner' | 'admin' | 'editor' | 'technician' | null);
    userInitials = getInitials({
      firstName: profile.first_name,
      lastName: profile.last_name,
      email: user.email ?? '',
    });

    const { data: business } = await supabase
      .from('businesses')
      .select('name')
      .eq('id', profile.business_id)
      .maybeSingle();

    if (business?.name) {
      businessName = business.name;
    }
    businessFaviconUrl = (await getBusinessBrandAssetUrls(profile.business_id)).faviconUrl;
  }

  return (
    <div className={`${backendSans.variable} ${backendSans.className} ${backendLabel.variable}`}>
      <AppShell
        businessName={businessName}
        businessFaviconUrl={businessFaviconUrl}
        userInitials={userInitials}
        userRole={userRole}
        isPlatformAdmin={isPlatformAdmin}
        leadNotifications={leadNotifications.notifications}
        unreadLeadCount={leadNotifications.unreadLeadCount}
      >
        {children}
      </AppShell>
    </div>
  );
}

function getInitials({
  firstName,
  lastName,
  email,
}: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string;
}) {
  const first = firstName?.trim().charAt(0) ?? '';
  const last = lastName?.trim().charAt(0) ?? '';

  if (first && last) {
    return `${first}${last}`.toUpperCase();
  }

  if (first) {
    return first.toUpperCase();
  }

  if (email) {
    const local = email.split('@')[0] ?? '';
    return local.slice(0, 2).toUpperCase() || 'U';
  }

  return 'U';
}
