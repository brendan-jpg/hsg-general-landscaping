import MediaLibraryManager from '@/components/backend/MediaLibraryManager';
import { getDashboardMediaLibraryData } from '@/lib/media/queries';

export default async function MediaPage() {
  const { items, usageByUrl, businessLogoUrl, businessFaviconUrl } = await getDashboardMediaLibraryData();
  return (
    <MediaLibraryManager
      initialItems={items}
      initialUsageByUrl={usageByUrl}
      initialBusinessLogoUrl={businessLogoUrl}
      initialBusinessFaviconUrl={businessFaviconUrl}
    />
  );
}
