'use client';

import { type MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/shared/AppImage';
import { trackEvent } from '@/components/analytics/NativeAnalytics';
import PrimaryButton from '@/components/frontend/PrimaryButton';
import type { HeaderNavMenuStyle, HeaderNavRenderItem } from '@/lib/navigation/headerNavigation';

interface HeaderProps {
  businessName?: string | null;
  logoUrl?: string | null;
  navItems?: HeaderNavRenderItem[];
}

function MegaMenuContent({
  items,
  onNavigate,
}: {
  items: HeaderNavRenderItem[];
  onNavigate: (item: HeaderNavRenderItem) => void;
}) {
  const [activeId, setActiveId] = useState<string>('');
  const [isMobile, setIsMobile] = useState(false);

  const activeItem = items.find((item) => item.id === activeId && item.children.length > 0) ?? null;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const sync = () => {
      const nextIsMobile = mediaQuery.matches;
      setIsMobile(nextIsMobile);
      if (!nextIsMobile) {
        setActiveId('');
      }
    };

    sync();
    mediaQuery.addEventListener('change', sync);
    return () => mediaQuery.removeEventListener('change', sync);
  }, []);

  function handleExpandableClick(
    event: ReactMouseEvent<HTMLAnchorElement>,
    item: HeaderNavRenderItem,
  ) {
    if (!isMobile || item.children.length === 0) {
      onNavigate(item);
      return;
    }

    if (activeId !== item.id) {
      event.preventDefault();
      setActiveId(item.id);
      return;
    }

    onNavigate(item);
  }

  return (
    <div className={`header__mega-flyout${activeItem && !isMobile ? ' is-split' : ''}`}>
      <ul className="header__mega-primary" aria-label="Menu groups">
        {items.map((item) => (
          <li
            key={item.id}
            className={`header__mega-primary-item${activeId === item.id ? ' is-active' : ''}`}
          >
            {item.children.length > 0 ? (
              <>
                {item.href ? (
                  <Link
                    href={item.href}
                    className={`header__mega-entry header__mega-entry--expandable${activeId === item.id ? ' is-active' : ''}`}
                    onMouseEnter={() => !isMobile && setActiveId(item.id)}
                    onFocus={() => !isMobile && setActiveId(item.id)}
                    onClick={(event) => handleExpandableClick(event, item)}
                  >
                    <span>{item.label}</span>
                    <span className="header__mega-caret" aria-hidden="true" />
                  </Link>
                ) : (
                  <span
                    className={`header__mega-entry header__mega-entry--expandable${activeId === item.id ? ' is-active' : ''}`}
                    onMouseEnter={() => !isMobile && setActiveId(item.id)}
                  >
                    <span>{item.label}</span>
                    <span className="header__mega-caret" aria-hidden="true" />
                  </span>
                )}
                <ul className={`header__mega-inline-children${activeId === item.id ? ' is-active' : ''}`}>
                  {item.children.map((child) => (
                    <li key={child.id}>
                      <Link href={child.href} className="header__mega-secondary-link" onClick={() => onNavigate(child)}>
                        {child.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <Link href={item.href} className="header__mega-entry" onClick={() => onNavigate(item)}>
                <span>{item.label}</span>
              </Link>
            )}
          </li>
        ))}
      </ul>

      {activeItem && !isMobile ? (
        <div className="header__mega-secondary">
          <ul className="header__mega-secondary-list">
            {activeItem.children.map((child) => (
              <li key={child.id}>
                <Link href={child.href} className="header__mega-secondary-link" onClick={() => onNavigate(child)}>
                  {child.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function HeaderNavChildren({
  items,
  onNavigate,
  depth = 0,
  parentMenuStyle = 'dropdown',
}: {
  items: HeaderNavRenderItem[];
  onNavigate: (item: HeaderNavRenderItem) => void;
  depth?: number;
  parentMenuStyle?: HeaderNavMenuStyle;
}) {
  if (items.length === 0) return null;

  if (depth === 0 && parentMenuStyle === 'mega') {
    return <MegaMenuContent items={items} onNavigate={onNavigate} />;
  }

  return (
    <ul className={`header__submenu-list header__submenu-list--depth-${depth}`}>
      {items.map((item) => (
        <li key={item.id} className="header__submenu-item">
          {item.children.length > 0 ? (
            <details className="header__submenu-group">
              <summary className="header__submenu-summary">
                <span>{item.label}</span>
              </summary>
              <div className="header__submenu-panel">
                <HeaderNavChildren items={item.children} onNavigate={onNavigate} depth={depth + 1} />
              </div>
            </details>
          ) : (
            <Link href={item.href} className="header__submenu-link" onClick={() => onNavigate(item)}>
              {item.label}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function Header({ businessName, logoUrl, navItems = [] }: HeaderProps) {
  const headerRef = useRef<HTMLElement | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const logoAlt = businessName ? `${businessName} Logo` : 'Business Logo';
  const items = navItems;

  function closeAllDropdowns() {
    if (!headerRef.current) return;
    const openDetails = headerRef.current.querySelectorAll('details[open]');
    openDetails.forEach((node) => node.removeAttribute('open'));
  }

  useEffect(() => {
    function handleDocumentPointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target || !headerRef.current) return;
      if (!headerRef.current.contains(target)) {
        closeAllDropdowns();
        setMobileOpen(false);
        return;
      }

      if (!(target instanceof Element)) return;
      const clickedInsideDropdown = target.closest('.header__group, .header__submenu-group');
      const clickedMobileToggle = target.closest('.header__mobile-toggle');
      if (!clickedInsideDropdown && !clickedMobileToggle) {
        closeAllDropdowns();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      closeAllDropdowns();
      setMobileOpen(false);
    }

    document.addEventListener('mousedown', handleDocumentPointerDown);
    document.addEventListener('touchstart', handleDocumentPointerDown, { passive: true });
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleDocumentPointerDown);
      document.removeEventListener('touchstart', handleDocumentPointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  function handleNavClick(item: HeaderNavRenderItem) {
    if (item.style === 'cta') trackEvent('cta_click');
    closeAllDropdowns();
    setMobileOpen(false);
  }

  function handleTopLevelToggle(current: HTMLDetailsElement) {
    if (!current.open || !headerRef.current) return;
    const openGroups = headerRef.current.querySelectorAll<HTMLDetailsElement>('.header__nav > .header__group[open]');
    openGroups.forEach((group) => {
      if (group !== current) group.removeAttribute('open');
    });
  }

  return (
    <header className="header" ref={headerRef}>
      <div className="header__inner">
        <Link
          href="/"
          className="header__logo"
          onClick={() => {
            closeAllDropdowns();
            setMobileOpen(false);
          }}
        >
          {logoUrl ? (
            <span className="header__logo-mark">
              <AppImage
                role="logo"
                src={logoUrl}
                alt={logoAlt}
                fill
                priority
                sizes="(max-width: 768px) 220px, 320px"
                style={{ objectFit: 'contain' }}
              />
            </span>
          ) : (
            <span>{businessName ?? 'Your Business'}</span>
          )}
        </Link>

        <button
          className="header__mobile-toggle"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
          aria-controls="site-nav"
        >
          <span />
          <span />
          <span />
        </button>

        <nav
          id="site-nav"
          className={`header__nav ${mobileOpen ? 'header__nav--open' : ''}`}
        >
          {items.map((item, index) => {
            const isLastItem = index === items.length - 1;
            const isPrimaryItem = item.style === 'cta' || isLastItem;

            return item.children.length > 0 ? (
              <details
                key={item.id}
                className={`header__group header__group--${item.menuStyle ?? 'dropdown'} ${isPrimaryItem ? 'header__group--cta' : ''}`}
                onToggle={(event) => handleTopLevelToggle(event.currentTarget)}
              >
                <summary className={`header__link header__summary ${isPrimaryItem ? 'header__cta btn btn--primary btn--primary-colorway' : ''}`}>
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="header__summary-link"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleNavClick(item);
                      }}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <span className="header__summary-link">{item.label}</span>
                  )}
                  <span className="header__summary-caret" aria-hidden="true" />
                </summary>
                <div className={`header__submenu header__submenu--${item.menuStyle ?? 'dropdown'}`}>
                  <HeaderNavChildren items={item.children} onNavigate={handleNavClick} parentMenuStyle={item.menuStyle ?? 'dropdown'} />
                </div>
              </details>
            ) : (
              isPrimaryItem ? (
                <PrimaryButton
                  key={item.id}
                  href={item.href}
                  className="header__cta"
                  onClick={() => handleNavClick(item)}
                >
                  {item.label}
                </PrimaryButton>
              ) : (
                <Link key={item.id} href={item.href} className="header__link" onClick={() => handleNavClick(item)}>
                  {item.label}
                </Link>
              )
            );
          })}
        </nav>
      </div>
    </header>
  );
}
