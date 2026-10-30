import Link from 'next/link';
import { notFound } from 'next/navigation';
import { offerings } from '@/components/public/offerings';
export default async function Offering({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const o = offerings.find((x) => x.id === slug);
  if (!o) notFound();
  return (
    <>
      <Link className="text-link" href="/catalogue">
        ← All offerings
      </Link>
      <div className="page-intro">
        <span className="eyebrow">{o.category}</span>
        <h1>{o.title}</h1>
        <p className="lead">{o.short}</p>
        <p className="muted">{o.description}</p>
      </div>
      <div className="split-layout">
        <section className="panel">
          <span className="eyebrow">Inside this preview</span>
          <h2>{o.available ? 'A seasonal perspective' : 'Explore a workflow opportunity'}</h2>
          <dl className="detail-list">
            <dt>Scenario inputs</dt>
            <dd>{o.inputs}</dd>
            <dt>What to expect</dt>
            <dd>{o.output}</dd>
            <dt>Availability</dt>
            <dd>
              {o.available
                ? 'Synthetic demonstration for approved, entitled workspaces with sandbox access.'
                : 'Catalogue concept. An interactive product demonstration is not implemented.'}
            </dd>
          </dl>
          <Link className="button" href={o.available ? '/workspaces' : '/request-demo'}>
            {o.available ? 'Open your workspace →' : 'Discuss this offering →'}
          </Link>
        </section>
        <aside className="panel">
          <h2>Bring your perspective</h2>
          <p className="muted">
            Approved client members can record private observations and propose reviewed community
            sharing.
          </p>
          <p className="muted">
            All hackathon examples are synthetic. Sandbox outputs are illustrative and do not
            constitute an approved credit, regulatory or business decision.
          </p>
          <Link className="text-link" href="/request-demo">
            Request a conversation ↗
          </Link>
        </aside>
      </div>
    </>
  );
}
