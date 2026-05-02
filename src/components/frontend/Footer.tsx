import Link from 'next/link';
import TrackedPhoneLink from '@/components/analytics/TrackedPhoneLink';
import AppImage from '@/components/shared/AppImage';
import MarkdownLite from '@/components/shared/MarkdownLite';
import { getActiveAreas, getActiveSystemPageHrefs } from '@/lib/content/queries';
import { getActiveServices } from '@/lib/services/queries';
import { buildAreaPath, buildServicePath } from '@/lib/utils/publicPaths';
import { getBusiness, getNavMenu } from '@/lib/utils/business';
import { parseFooterBuilderConfigFromBusinessSettings } from '@/lib/navigation/footerBuilder';
import { formatBusinessLicensesMarkdown, parseBusinessLicenses } from '@/lib/utils/licenses';
import { formatPhone } from '@/lib/utils';

interface MenuItem {
  label?: string;
  url?: string;
}

type SystemPageHrefKey = 'home' | 'services' | 'service-areas' | 'about' | 'blog' | 'contact';

function parseMenuItems(value: unknown): MenuItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item && typeof item === 'object' ? (item as MenuItem) : null))
    .filter((item): item is MenuItem => Boolean(item?.label && item?.url));
}

function getVisibleText(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

export default async function Footer() {
  const [business, footerMenu, services, areas, systemPageHrefs] = await Promise.all([
    getBusiness(),
    getNavMenu('footer'),
    getActiveServices(),
    getActiveAreas(),
    getActiveSystemPageHrefs(),
  ]);
  const footerItems = parseMenuItems(footerMenu?.items);
  const normalizedFooterItems = footerItems.map((item) => ({
    ...item,
    url:
      item.url === '/services'
        ? systemPageHrefs.services
        : item.url === '/service-areas'
          ? systemPageHrefs['service-areas']
          : item.url === '/blog'
            ? systemPageHrefs.blog
            : item.url === '/contact'
              ? systemPageHrefs.contact
          : item.url,
  }));
  const baseLinks = footerItems.length > 0
    ? normalizedFooterItems
    : [
        { label: 'Services', url: systemPageHrefs.services },
        { label: 'Areas', url: systemPageHrefs['service-areas'] },
        { label: 'Blog', url: systemPageHrefs.blog },
        { label: 'Contact', url: systemPageHrefs.contact },
        { label: 'Login', url: '/login' },
      ];
  const links = baseLinks.some((item) => item.url === '/login')
    ? baseLinks
    : [...baseLinks, { label: 'Login', url: '/login' }];
  const footerServices = services.filter((service) => !service.parent_service_id && service.slug?.trim());
  const footerBuilderConfig = parseFooterBuilderConfigFromBusinessSettings(business?.settings);

  const businessName = business?.name ?? 'Your Business';
  const hsgHref = 'https://hsgrowth.com';
  const addressLine = [business?.address_line1, business?.city, business?.state, business?.zip]
    .filter(Boolean)
    .join(', ');
  const licenseNumbers = parseBusinessLicenses(
    business?.settings && typeof business.settings === 'object' && !Array.isArray(business.settings)
      ? (business.settings as Record<string, unknown>).license_numbers
      : [],
  );
  const licenseMarkdown = formatBusinessLicensesMarkdown(licenseNumbers);

  const replaceFooterTokens = (value: string) =>
    value
      .replace(/\{\{business_name\}\}/g, businessName)
      .replace(/\{\{business_phone\}\}/g, business?.phone ? formatPhone(business.phone) : '')
      .replace(/\{\{business_email\}\}/g, business?.email ?? '')
      .replace(/\{\{business_address\}\}/g, addressLine)
      .replace(/\{\{business_licenses\}\}/g, licenseMarkdown);

  const resolveBuilderLinkHref = (sourcePageSlug: string | null, href: string) => {
    if (sourcePageSlug === 'home') return '/';
    if (sourcePageSlug) {
      const pageKey = sourcePageSlug as SystemPageHrefKey;
      const systemHref = (systemPageHrefs as Partial<Record<SystemPageHrefKey, string>>)[pageKey];
      return systemHref ?? `/${sourcePageSlug}`;
    }
    const trimmedHref = href.trim();
    const slug = trimmedHref.replace(/^\/+|\/+$/g, '').toLowerCase();
    const matchingService = services.find((service) => (service.slug ?? '').trim().toLowerCase() === slug);
    if (matchingService?.slug) return buildServicePath(matchingService.slug, business?.settings);
    const matchingArea = areas.find((area) => (area.slug ?? '').trim().toLowerCase() === slug);
    if (matchingArea?.slug) return buildAreaPath(matchingArea.slug, business?.settings);
    return trimmedHref || '#';
  };

  if (footerBuilderConfig && footerBuilderConfig.columns.length > 0) {
    return (
      <footer className="footer">
        <div className="footer__inner">
          {footerBuilderConfig.columns.map((column) => (
            <div key={column.id} className="footer__column">
              {column.title ? <p className="footer__title">{column.title}</p> : null}
              <div className="footer__content">
                {column.items.map((item) => {
                  if (item.type === 'text') {
                    const blockTitle = getVisibleText(replaceFooterTokens(item.heading));
                    return (
                      <div key={item.id} className="footer__block footer__block--text">
                        {blockTitle ? <p className="footer__block-title">{blockTitle}</p> : null}
                        {item.body ? (
                          <div className="footer__text">
                            <MarkdownLite content={replaceFooterTokens(item.body)} />
                          </div>
                        ) : null}
                      </div>
                    );
                  }

                  if (item.type === 'links') {
                    const blockTitle = getVisibleText(item.heading);
                    return (
                      <div key={item.id} className="footer__block footer__block--links">
                        {blockTitle ? <p className="footer__block-title">{blockTitle}</p> : null}
                        <nav className="footer__nav">
                          {item.links.map((link) => {
                            const href = resolveBuilderLinkHref(link.sourcePageSlug, link.href);
                            return (
                              <Link key={link.id} href={href}>
                                {link.label || href}
                              </Link>
                            );
                          })}
                        </nav>
                      </div>
                    );
                  }

                  const blockTitle = getVisibleText(item.heading);
                  return (
                    <div key={item.id} className="footer__block footer__block--media">
                      {blockTitle ? <p className="footer__block-title">{blockTitle}</p> : null}
                      <div className={`footer__media-grid footer__media-grid--${Math.max(item.images.length, 1)}`}>
                        {item.images.map((imageUrl, imageIndex) => (
                          <div key={`${item.id}-${imageIndex}`} className="footer__media-item">
                            <AppImage
                              role="content"
                              src={imageUrl}
                              alt={`${column.title || item.heading || businessName} image ${imageIndex + 1}`}
                              width={1200}
                              height={900}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="footer__bottom container">
          <p>&copy; {new Date().getFullYear()} {businessName}. All rights reserved.</p>
          <Link
            href={hsgHref}
            className="footer__hsg-link"
            target="_blank"
            rel="noreferrer"
            aria-label="Built with HSG"
          >
            <AppImage
              role="logo"
              src="/graphics/logo/hsg-footer-logo.svg"
              alt="HSG"
              width={164}
              height={40}
              className="footer__hsg-logo"
            />
          </Link>
        </div>
      </footer>
    );
  }

  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__brand">
          {business?.logo_url && (
            <Link href="/" className="footer__logo-link header__logo">
              <span className="header__logo-mark">
                <AppImage
                  role="logo"
                  src={business.logo_url}
                  alt={`${businessName} Logo`}
                  width={180}
                  height={90}
                  className="footer__logo-image"
                />
              </span>
            </Link>
          )}
          {!business?.logo_url ? <h3>{businessName}</h3> : null}
        </div>
        <nav className="footer__nav">
          <p className="footer__title">Quick Links</p>
          {links.map((item) => (
            <Link key={`${item.label}-${item.url}`} href={item.url!}>
              {item.label}
            </Link>
          ))}
        </nav>
        <nav className="footer__nav footer__services">
          <p className="footer__title">Services</p>
          {footerServices.map((service) => (
            <Link key={service.id} href={buildServicePath(service.slug ?? '', business?.settings)}>
              {service.title ?? 'Service'}
            </Link>
          ))}
        </nav>
        <div className="footer__contact">
          <p className="footer__title">Reach Us</p>
          {business?.phone && (
            <p>
              <TrackedPhoneLink phone={business.phone} />
            </p>
          )}
          {business?.email && <p>{business.email}</p>}
          {addressLine && <p>{addressLine}</p>}
        </div>
      </div>
      <div className="footer__bottom container">
        <p>&copy; {new Date().getFullYear()} {businessName}. All rights reserved.</p>
        <Link
          href={hsgHref}
          className="footer__hsg-link"
          target="_blank"
          rel="noreferrer"
          aria-label="Built with HSG"
        >
          <AppImage
            role="logo"
            src="/graphics/logo/hsg-footer-logo.svg"
            alt="HSG"
            width={164}
            height={40}
            className="footer__hsg-logo"
          />
        </Link>
      </div>
    </footer>
  );
}
