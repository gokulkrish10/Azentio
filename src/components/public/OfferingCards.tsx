import Link from 'next/link';
import { offerings } from './offerings';
export function OfferingCards() {
  return (
    <div className="offering-grid">
      {offerings.map((o) => (
        <article className="offering-card" key={o.id}>
          <div className="row between">
            <span className="index-label">
              {o.number} / {o.category}
            </span>
            <span className="arrow-icon" aria-hidden="true">
              ↗
            </span>
          </div>
          <h3>{o.title}</h3>
          <p className="offering-tagline">{o.short}</p>
          <p className="muted">{o.description}</p>
          <Link className="text-link" href={`/catalogue/${o.id}`}>
            Explore offering →
          </Link>
        </article>
      ))}
    </div>
  );
}
