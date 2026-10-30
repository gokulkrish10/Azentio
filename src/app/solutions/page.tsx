import Link from 'next/link';
export const metadata = { title: 'Solutions' };
export default function Solutions() {
  return (
    <>
      <div className="page-intro">
        <span className="eyebrow">From observation to opportunity</span>
        <h1>
          Start with the challenge
          <br />
          you understand best.
        </h1>
        <p className="lead">
          Explore a scenario, share permitted evidence and help shape an improvement.
        </p>
      </div>
      <div className="editorial-list">
        {[
          [
            '01',
            'Put financial changes in context',
            'Our synthetic SME scenario explores why equivalent-period comparisons matter when cash flow is seasonal.',
            'financial-analysis-intelligence',
          ],
          [
            '02',
            'Make document workflows easier to explain',
            'Bring observations about review bottlenecks, evidence quality and interpretation. Document processing itself is outside this preview.',
            'document-intelligence',
          ],
          [
            '03',
            'Clarify reporting challenges',
            'Describe recurring reporting and interpretation challenges without disclosing customer records or confidential contractual details.',
            'regulatory-intelligence',
          ],
        ].map(([n, t, b, s]) => (
          <article key={n}>
            <span className="index-label">{n}</span>
            <div>
              <h2>{t}</h2>
              <p className="muted">{b}</p>
              <Link className="text-link" href={`/catalogue/${s}`}>
                Explore the offering →
              </Link>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
