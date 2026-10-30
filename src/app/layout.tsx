import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
export const metadata: Metadata = {
  title: 'Azentio | Collaboration portal',
  description: 'Governed learning and evidence-linked improvement. Synthetic demonstration.',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <header>
          <Link className="brand" href="/">
            azentio<span>.ai</span>
          </Link>
          <span className="divider" />
          <span className="portal-label">Collaboration portal</span>
          <nav>
            <Link href="/workspaces">Workspaces</Link>
            <Link href="/login">Sign in</Link>
          </nav>
        </header>
        <main id="main">{children}</main>
        <footer>
          Synthetic demonstration · Reviewed evidence, explicit sharing, human decisions.
        </footer>
      </body>
    </html>
  );
}
