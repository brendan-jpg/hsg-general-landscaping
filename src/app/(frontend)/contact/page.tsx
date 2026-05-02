import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getActivePageByKind } from '@/lib/content/queries';
import { renderContactPageContent } from '@/lib/frontend/contactPage';
import { buildDynamicMetadata } from '@/lib/utils/seo';

export async function generateMetadata(): Promise<Metadata> {
  const page = await getActivePageByKind('contact');

  return buildDynamicMetadata({
    titleTemplate: page?.meta_title,
    descriptionTemplate: page?.meta_description,
    fallbackTitle: page?.title || 'Contact',
    fallbackDescription: page?.meta_description,
    imageUrl: page?.og_image_url,
    pathname: page?.slug ? `/${page.slug}` : '/contact',
  });
}

export default async function ContactPage() {
  const page = await getActivePageByKind('contact');
  if (page?.slug && page.slug !== 'contact') {
    redirect(`/${page.slug}`);
  }
  return renderContactPageContent(page);
}




