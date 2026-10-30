import Link from 'next/link';
export const metadata = { title: 'Our approach' };
export default function About() {
  return (
    <>
      <div className="page-intro">
        <span className="eyebrow">Our approach</span>
        <h1>
          Shared progress starts
          <br />
          with earned trust.
        </h1>
        <p className="lead">
          azentio.ai brings public discovery, employee innovation and client perspectives into a
          governed collaboration workflow.
        </p>
      </div>
      <div className="editorial-list">
        {[
          [
            '01',
            'Begin privately',
            'Save an observation for yourself, or explicitly share its source within your organisation. Saving never publishes it to the learning community.',
          ],
          [
            '02',
            'Review before sharing',
            'Community publication requires separate permission and moderator review. The reviewed copy is kept separate from the private original.',
          ],
          [
            '03',
            'Connect evidence to action',
            'Approved contributions support themes and improvement ideas. Product owners communicate status without exposing private client material.',
          ],
          [
            '04',
            'Keep people in control',
            'Contributors can withdraw shared contributions from future access. Material already viewed or copied cannot automatically be recalled. No model training runs in this preview.',
          ],
        ].map(([n, t, b]) => (
          <article key={n}>
            <span className="index-label">{n}</span>
            <div>
              <h2>{t}</h2>
              <p className="muted">{b}</p>
            </div>
          </article>
        ))}
      </div>
      <section className="cta-band">
        <h2>Your perspective belongs in the conversation.</h2>
        <Link className="button" href="/workspaces">
          Find your workspace →
        </Link>
      </section>
    </>
  );
}
