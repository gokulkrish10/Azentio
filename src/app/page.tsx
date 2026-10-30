import Link from 'next/link';
export default function Home() {
  return (
    <>
      <span className="eyebrow">Governed collective learning</span>
      <h1>Turn observations into shared progress.</h1>
      <p className="muted">
        A private workspace for useful observations. An explicit review process for shared learning.
        Evidence that informs better offerings.
      </p>
      <div className="row">
        <Link className="button" href="/workspaces">
          Open your workspace →
        </Link>
        <Link href="/login">Sign in with a verified account</Link>
      </div>
      <div className="grid" style={{ marginTop: 48 }}>
        {[
          [
            '01',
            'Observe privately',
            'Save a private draft. Choose separately whether your organisation can see it.',
          ],
          [
            '02',
            'Share with care',
            'Propose a revision for moderator review and redaction. Saving alone never publishes.',
          ],
          [
            '03',
            'Improve with evidence',
            'Approved contributions inform themes and improvement ideas. Every decision stays with people.',
          ],
        ].map(([n, t, b]) => (
          <section className="panel" key={n}>
            <span className="eyebrow">{n}</span>
            <h2>{t}</h2>
            <p className="muted">{b}</p>
          </section>
        ))}
      </div>
      <p className="muted">
        Foundation preview · Public catalogue and dashboard presentation are owned by Sethu.
      </p>
    </>
  );
}
