import Link from 'next/link';
import { redirect } from 'next/navigation';
import { portal } from '@/server/portal';
import { HttpError } from '@/server/http';
import { uuid } from '@/shared/contracts';
import { ModerationQueue } from '@/components/core/ModerationQueue';
export const dynamic = 'force-dynamic';
export default async function Moderation({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) return <h1>Review access unavailable.</h1>;
  try {
    const data = await portal('moderation.list', id, {});
    return (
      <>
        <Link href={`/workspace/${id}`}>← Back to active workspace</Link>
        <h1>Review proposed learning</h1>
        <p className="muted">
          Only submitted revisions are available. Review permission is separate from content
          publishing, administration and private draft access.
        </p>
        <ModerationQueue workspaceId={id} items={data.items} />
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
