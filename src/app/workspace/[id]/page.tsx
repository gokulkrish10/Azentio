import Link from 'next/link';
import { redirect } from 'next/navigation';
import { portal } from '@/server/portal';
import { identity } from '@/server/auth';
import { HttpError } from '@/server/http';
import { uuid } from '@/shared/contracts';
import { SignOutButton } from '@/components/core/SignOutButton';
import { ObservationWorkspace } from '@/components/core/ObservationWorkspace';
export const dynamic = 'force-dynamic';
export default async function Workspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) return <h1>Workspace unavailable.</h1>;
  try {
    const { user } = await identity();
    const dashboard = await portal('dashboard', id, {});
    const workspaces = await portal('workspaces', null, {});
    const w = workspaces.items.find((x) => x.id === id);
    const observations = await portal('observations.list', id, {});
    return (
      <>
        <div className="row between">
          <span className="eyebrow">Active workspace · {w?.kind}</span>
          <Link href="/workspaces">Switch workspace</Link>
          <SignOutButton />
        </div>
        <h1>{w?.name}</h1>
        <p className="muted">
          {dashboard.offerings.length} entitled offering(s) · {dashboard.contributionCount} of your
          observations
        </p>
        {dashboard.capabilities.includes('learning.moderate') && (
          <Link className="button secondary" href={`/workspace/${id}/moderation`}>
            Open moderation queue →
          </Link>
        )}
        <ObservationWorkspace
          workspaceId={id}
          userId={user.id}
          dashboard={dashboard}
          items={observations.items}
        />
      </>
    );
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) redirect('/login');
    return (
      <>
        <h1>Workspace unavailable.</h1>
        <p className="muted">
          An approved current membership and offering entitlement are required. Your session does
          not grant access by itself.
        </p>
        <Link href="/workspaces">Choose another workspace</Link>
      </>
    );
  }
}
