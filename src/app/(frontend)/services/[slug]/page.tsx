import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { renderServiceDetailPageBySlug, generateServiceDetailMetadataBySlug } from '@/lib/frontend/detailPages';
import { getBusiness } from '@/lib/utils/business';
import { buildServicePath, DEFAULT_SERVICE_DETAIL_BASE_SEGMENT } from '@/lib/utils/publicPaths';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return generateServiceDetailMetadataBySlug(slug);
}

export default async function ServiceDetailPage({ params }: Props) {
  const { slug } = await params;
  const business = await getBusiness();
  const canonicalPath = buildServicePath(slug, business?.settings);
  const defaultPath = `/${DEFAULT_SERVICE_DETAIL_BASE_SEGMENT}/${slug}`;
  if (canonicalPath !== defaultPath) redirect(canonicalPath);
  return renderServiceDetailPageBySlug(slug);
}

