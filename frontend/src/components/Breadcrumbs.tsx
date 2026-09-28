'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  customItems?: BreadcrumbItem[];
}

export default function Breadcrumbs({ customItems }: BreadcrumbsProps) {
  const pathname = usePathname();

  const getAutoItems = (): BreadcrumbItem[] => {
    if (pathname === '/') {
      return [{ label: 'Dashboard' }];
    }

    const segments = pathname.split('/').filter(Boolean);
    const items: BreadcrumbItem[] = [{ label: 'Dashboard', href: '/' }];

    if (segments[0] === 'academy') {
      items.push({ label: 'Learn & Tracks', href: '/academy' });
    } else if (segments[0] === 'sessions') {
      items.push({ label: 'Active Labs', href: '/sessions' });
      if (segments.length >= 2) {
        const action = segments[2] || '';
        if (action === 'desktop') {
          items.push({ label: 'Kali Linux GUI' });
        } else if (action === 'terminal') {
          items.push({ label: 'Interactive Shell' });
        } else {
          items.push({ label: 'Session Workspace' });
        }
      }
    } else if (segments[0] === 'profile') {
      items.push({ label: 'My Progress' });
    } else if (segments[0] === 'instructor') {
      items.push({ label: 'Instructor Portal' });
    } else {
      segments.forEach((seg, idx) => {
        const href = '/' + segments.slice(0, idx + 1).join('/');
        items.push({
          label: seg.charAt(0).toUpperCase() + seg.slice(1),
          href: idx === segments.length - 1 ? undefined : href
        });
      });
    }

    return items;
  };

  const items = customItems || getAutoItems();

  return (
    <nav
      aria-label="Breadcrumb navigation"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '0.78rem',
        fontWeight: 600,
        color: '#64748b'
      }}
    >
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;

        return (
          <React.Fragment key={idx}>
            {idx > 0 && (
              <span
                style={{
                  color: '#cbd5e1',
                  fontSize: '0.75rem',
                  userSelect: 'none'
                }}
              >
                /
              </span>
            )}

            {item.href && !isLast ? (
              <Link
                href={item.href}
                style={{
                  color: '#64748b',
                  textDecoration: 'none',
                  transition: 'color 0.15s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--blue, #2E4C6D)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
              >
                {idx === 0 && <span style={{ fontSize: '0.85rem' }}>📊</span>}
                <span>{item.label}</span>
              </Link>
            ) : (
              <span
                style={{
                  color: isLast ? 'var(--blue, #2E4C6D)' : '#0f172a',
                  fontWeight: isLast ? 700 : 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                aria-current={isLast ? 'page' : undefined}
              >
                {idx === 0 && <span style={{ fontSize: '0.85rem' }}>📊</span>}
                <span>{item.label}</span>
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
