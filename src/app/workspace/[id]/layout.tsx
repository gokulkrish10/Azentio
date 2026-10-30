import Link from 'next/link';
import { redirect } from 'next/navigation';
import { portal } from '@/server/portal';
import { HttpError } from '@/server/http';
import { uuid } from '@/shared/contracts';
import { WorkspaceNav } from '@/components/portal/WorkspaceNav';
import { SharingAcknowledgement } from '@/components/portal/SharingAcknowledgement';
export const dynamic = 'force-dynamic';
export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) return <p className="message error">Workspace unavailable.</p>;
  let workspace, dashboard;
  try {
    const result = await portal('workspaces', null, {});
    workspace = result.items.find((w) => w.id === id);
    if (!workspace) throw new HttpError(403, 'ACCESS_DENIED');
    dashboard = await portal('dashboard', id, {});
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) redirect('/login');
    return (
      <section className="panel">
        <span className="eyebrow">Workspace access</span>
        <h1>We can’t open this workspace.</h1>
        <p className="muted">
          Access requires a verified account and a current approved membership. If the service is
          unavailable, try again shortly.
        </p>
        <Link className="button secondary" href="/workspaces">
          Choose a workspace →
        </Link>
      </section>
    );
  }
  return (
    <div className="workspace-shell">
      <WorkspaceNav workspace={workspace} dashboard={dashboard} />
      <div className="workspace-content" key={id}>
        {dashboard.onboarding && !dashboard.onboarding.acknowledged && (
          <SharingAcknowledgement workspaceId={id} />
        )}
        {children}
      </div>
    </div>
  );
}
