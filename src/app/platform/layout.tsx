import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import '@/styles/backend/shell/module-shell.css';
import '@/styles/backend/components/components.css';
import '@/styles/backend/components/editor.css';
import '@/styles/backend/pages/pages.css';

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

export const metadata = {
  title: 'Platform Workspace',
};

export default function PlatformWorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${backendSans.variable} ${backendSans.className} ${backendLabel.variable} shell platform-theme-standalone-shell`}>
      {children}
    </div>
  );
}
