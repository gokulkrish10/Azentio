import Link from 'next/link';
import { OfferingCards } from '@/components/public/OfferingCards';
export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="status-dot" /> Enterprise AI · Human perspective
          </span>
          <h1>
            Intelligence grows
            <br />
            when we <em>connect.</em>
          </h1>
          <p className="lead">
            Explore what’s possible with AI. Bring your perspective. Turn shared learning into
            better offerings, together.
          </p>
          <div className="row">
            <Link className="button" href="/catalogue">
              Explore our offerings ↗
            </Link>
            <Link className="text-link" href="/workspaces">
              Enter your workspace →
            </Link>
          </div>
          <p className="hero-note">
            Public discovery. Private collaboration. Reviewed shared learning.
          </p>
        </div>
        <div
          className="learning-visual"
          aria-label="Illustration of the reviewed learning workflow"
        >
          <div className="visual-heading">
            <span className="status-dot" /> THE COLLECTIVE LEARNING LOOP <span>↗</span>
          </div>
          <div className="orbit">
            <div className="orbit-inner">
              <span>
                azentio<span className="green">.ai</span>
              </span>
              <small>Perspective into progress</small>
            </div>
            <span className="orbit-point point-a">01 · Observe</span>
            <span className="orbit-point point-b">02 · Review</span>
            <span className="orbit-point point-c">03 · Improve</span>
          </div>
          <div className="visual-foot">
            <span>Private by default</span>
            <span>Shared with permission</span>
          </div>
        </div>
      </section>
      <div className="principle-strip">
        <span>Designed for shared progress</span>
        <strong>Explicit permission</strong>
        <strong>Reviewed evidence</strong>
        <strong>Human decisions</strong>
      </div>
      <section className="section-space">
        <div className="section-heading">
          <div>
            <span className="eyebrow">The offering collection</span>
            <h2>
              Practical questions.
              <br />
              New possibilities.
            </h2>
          </div>
          <p className="muted">
            Discover our hackathon catalogue and explore synthetic scenarios in your entitled
            workspace.
          </p>
        </div>
        <OfferingCards />
      </section>
      <section className="collaboration-section section-space">
        <div>
          <span className="eyebrow">A place for every perspective</span>
          <h2>
            One connected experience.
            <br />
            Clear boundaries.
          </h2>
          <p className="muted">
            Useful collaboration starts with knowing who can see what. Your workspace keeps private
            contributions separate from approved shared learning.
          </p>
          <Link className="text-link" href="/about">
            How collaboration works →
          </Link>
        </div>
        <div className="audience-list">
          {[
            [
              '01',
              'For curious minds',
              'Explore the offering collection and start a conversation.',
              '/catalogue',
            ],
            [
              '02',
              'For our clients',
              'Contribute observations and follow reviewed ideas within your approved workspace.',
              '/workspaces',
            ],
            [
              '03',
              'For our employees',
              'Connect permitted evidence to improvement work through your employee workspace.',
              '/workspaces',
            ],
          ].map(([n, t, b, h]) => (
            <Link href={h} key={n}>
              <span className="index-label">{n}</span>
              <div>
                <h3>{t}</h3>
                <p>{b}</p>
              </div>
              <span aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      </section>
      <section className="cta-band">
        <span className="eyebrow">Start with a conversation</span>
        <h2>What could we improve together?</h2>
        <div className="row">
          <Link className="button" href="/request-demo">
            Request a demo →
          </Link>
          <Link className="text-link" href="/events">
            Register hackathon interest ↗
          </Link>
        </div>
        <p className="muted">Hackathon preview · Demonstrations use synthetic data.</p>
      </section>
    </>
  );
}
