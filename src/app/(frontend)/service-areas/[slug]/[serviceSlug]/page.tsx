import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

interface Props {
  params: Promise<{ slug: string; serviceSlug: string }>;
}

export async function generateMetadata(_: Props): Promise<Metadata> {
  return {};
}

export default async function RetiredComboLandingPage(_: Props) {
  notFound();
}



