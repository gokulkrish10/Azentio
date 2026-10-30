import type { SharedPublication } from '@/shared/contracts';
export function EmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <p>{children}</p>
    </div>
  );
}
export function QueryState({ error, retry }: { error?: string; retry: () => void }) {
  return error ? (
    <div className="message error" role="alert">
      <p>{error}</p>
      <button type="button" className="secondary" onClick={retry}>
        Try again
      </button>
    </div>
  ) : (
    <div className="loading-state" role="status">
      <span className="status-dot" /> Loading permitted records…
    </div>
  );
}
export function Pager({
  page,
  count,
  busy,
  setPage,
}: {
  page: number;
  count: number;
  busy: boolean;
  setPage: (page: number) => void;
}) {
  return (
    <div className="pager">
      <button
        type="button"
        className="secondary"
        disabled={busy || page === 0}
        onClick={() => setPage(page - 1)}
      >
        ← Previous
      </button>
      <span>Page {page + 1}</span>
      <button
        type="button"
        className="secondary"
        disabled={busy || count < 20 || page >= 500}
        onClick={() => setPage(page + 1)}
      >
        Next →
      </button>
    </div>
  );
}
export function Publication({
  item,
  children,
}: {
  item: SharedPublication;
  children?: React.ReactNode;
}) {
  return (
    <article className="publication-card" id={`evidence-${item.id}`}>
      <div className="row">
        <span className="badge">Reviewed shared copy</span>
        <span className="index-label">{item.offeringId.replaceAll('-', ' ')}</span>
      </div>
      <h2>{item.title}</h2>
      <p className="prose">{item.body}</p>
      <div className="metadata-row">
        <span>{item.topic}</span>
        <span>{item.industry}</span>
        <span>{item.region}</span>
        <span>{item.confidence} confidence</span>
      </div>
      <div className="metadata-row">
        <span>
          Observed {item.periodStart} – {item.periodEnd}
        </span>
        <span>{item.evidenceType}</span>
      </div>
      {item.attribution && <p className="subtle-note">Reviewed attribution: {item.attribution}</p>}
      {children}
    </article>
  );
}
