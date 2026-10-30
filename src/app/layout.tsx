import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import './ui.css';
import { SiteHeader } from '@/components/public/SiteHeader';
export const metadata: Metadata = {
  title: { default: 'azentio.ai | Intelligence, together', template: '%s | azentio.ai' },
  description: 'Governed learning and evidence-linked improvement. Synthetic demonstration.',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
        <footer className="site-footer">
          <div>
            <Link className="brand" href="/">
              azentio<span>.ai</span>
            </Link>
            <p>Build intelligence. Create shared value.</p>
          </div>
          <nav aria-label="Footer navigation">
            <Link href="/about">Our approach</Link>
            <Link href="/events">Hackathon interest</Link>
            <Link href="/login">Sign in</Link>
          </nav>
          <p className="footer-disclaimer">
            Synthetic hackathon demonstration. Reviewed evidence, explicit sharing, human decisions.
          </p>
        </footer>
      </body>
    </html>
  );
}
