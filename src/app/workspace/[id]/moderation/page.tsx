import Link from 'next/link';
import { redirect } from 'next/navigation';
import { portal } from '@/server/portal';
import { HttpError } from '@/server/http';
import { uuid } from '@/shared/contracts';
import { ModerationQueue } from '@/components/core/ModerationQueue';
import { CommentReview } from '@/components/portal/LearningTools';
import { PageLinks, parsePage } from '@/components/portal/PageLinks';
export const dynamic = 'force-dynamic';
export default async function Moderation({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { id } = await params;
  const page = parsePage((await searchParams).page);
  if (!uuid.safeParse(id).success) return <h1>Review access unavailable.</h1>;
  try {
    const data = await portal('moderation.list', id, { page, pageSize: 20 });
    return (
      <>
        <Link href={`/workspace/${id}`}>← Back to active workspace</Link>
        <h1>Review proposed learning</h1>
        <p className="muted">
          Only submitted revisions are available. Review permission is separate from content
          publishing, administration and private draft access.
        </p>
        <ModerationQueue workspaceId={id} items={data.items} />
        <PageLinks path={`/workspace/${id}/moderation`} page={page} count={data.items.length} />
        <CommentReview workspaceId={id} />
      </>
    );
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) redirect('/login');
    return (
      <>
        <h1>Review access unavailable.</h1>
        <p className="muted">
          An approved employee membership, moderation grant and offering entitlement are required.
        </p>
      </>
    );
  }
}
