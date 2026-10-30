'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <Link className="brand" href="/" onClick={() => setOpen(false)}>
        azentio<span>.ai</span>
      </Link>
      <span className="brand-caption">Intelligence, together.</span>
      <button
        className="secondary menu-toggle"
        aria-expanded={open}
        aria-controls="site-nav"
        onClick={() => setOpen(!open)}
      >
        Menu {open ? '−' : '+'}
      </button>
      <nav
        id="site-nav"
        aria-label="Main navigation"
        className={open ? 'site-nav is-open' : 'site-nav'}
      >
        {(
          [
            ['/catalogue', 'Offerings'],
            ['/solutions', 'Solutions'],
            ['/insights', 'Insights'],
            ['/about', 'Our approach'],
            ['/workspaces', 'Workspace ↗'],
          ] as const
        ).map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname.startsWith(href) ? 'page' : undefined}
            onClick={() => setOpen(false)}
          >
            {label}
          </Link>
        ))}
        <Link className="button small-button" href="/request-demo" onClick={() => setOpen(false)}>
          Let’s talk →
        </Link>
      </nav>
    </header>
  );
}
