import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { generateAreaDetailMetadataBySlug, renderAreaDetailPageBySlug } from '@/lib/frontend/detailPages';
import { getBusiness } from '@/lib/utils/business';
import { buildAreaPath, DEFAULT_AREA_DETAIL_BASE_SEGMENT } from '@/lib/utils/publicPaths';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return generateAreaDetailMetadataBySlug(slug);
}

export default async function AreaDetailPage({ params }: Props) {
  const { slug } = await params;
  const business = await getBusiness();
  const canonicalPath = buildAreaPath(slug, business?.settings);
  const defaultPath = `/${DEFAULT_AREA_DETAIL_BASE_SEGMENT}/${slug}`;
  if (canonicalPath !== defaultPath) redirect(canonicalPath);
  return renderAreaDetailPageBySlug(slug);
}

