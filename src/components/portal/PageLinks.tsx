import Link from 'next/link';
export function parsePage(value: string | string[] | undefined) {
  const page = typeof value === 'string' ? Number(value) : 0;
  return Number.isInteger(page) && page >= 0 && page <= 500 ? page : 0;
}
export function PageLinks({ path, page, count }: { path: string; page: number; count: number }) {
  return (
    <nav className="pager" aria-label="Record pages">
      {page > 0 ? (
        <Link className="button secondary" href={`${path}?page=${page - 1}`}>
          ← Previous
        </Link>
      ) : (
        <span>Previous</span>
      )}
      <span>Page {page + 1}</span>
      {count === 20 && page < 500 ? (
        <Link className="button secondary" href={`${path}?page=${page + 1}`}>
          Next →
        </Link>
      ) : (
        <span>Next</span>
      )}
    </nav>
  );
}
