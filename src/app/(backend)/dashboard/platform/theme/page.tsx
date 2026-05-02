import { redirect } from 'next/navigation';

type LegacyPlatformThemePageProps = {
  searchParams?: Promise<{
    client?: string;
  }>;
};

export default async function LegacyPlatformThemePage({ searchParams }: LegacyPlatformThemePageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const client = resolvedSearchParams?.client?.trim() ?? '';
  redirect(client ? `/platform/theme?client=${encodeURIComponent(client)}` : '/platform/theme');
}
