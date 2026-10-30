'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Workspace, Dashboard } from '@/shared/contracts';
import { SignOutButton } from '@/components/core/SignOutButton';
export function WorkspaceNav({
  workspace,
  dashboard,
}: {
  workspace: Workspace;
  dashboard: Dashboard;
}) {
  const path = usePathname(),
    base = `/workspace/${workspace.id}`;
  const links = [
    ['dashboard', 'Overview', true],
    ['administration', 'Administration', dashboard.capabilities.includes('portal.admin')],
    ['library', 'Sessions & resources', true],
    ['teams', 'Team spaces', workspace.kind === 'employee'],
    ['', 'Observations', dashboard.capabilities.includes('observations.write')],
    ['learning', 'Shared learning', dashboard.capabilities.includes('learning.read')],
    ['bookmarks', 'Saved evidence', dashboard.capabilities.includes('learning.read')],
    ['themes', 'Themes', dashboard.capabilities.includes('learning.read')],
    ['ideas', 'Improvement ideas', dashboard.capabilities.includes('learning.read')],
    ['playground', 'Playground', dashboard.capabilities.includes('sandbox.run')],
    ['assistant', 'Ask AIRA', dashboard.capabilities.includes('learning.read')],
    ['notifications', 'Notifications', true],
    ['members', 'Members', dashboard.capabilities.includes('members.manage')],
    ['moderation', 'Moderation', dashboard.capabilities.includes('learning.moderate')],
  ] as const;
  return (
    <aside className="workspace-sidebar">
      <div className="workspace-identity">
        <span className="eyebrow">{workspace.kind} workspace</span>
        <h2>{workspace.name}</h2>
        <span className="muted">{workspace.role.replaceAll('_', ' ')}</span>
      </div>
      <nav aria-label="Workspace navigation">
        {links
          .filter(([, , visible]) => visible)
          .map(([slug, label]) => {
            const href = slug ? `${base}/${slug}` : base;
            return (
              <Link href={href} key={slug} aria-current={path === href ? 'page' : undefined}>
                <span>{label}</span>
                <span aria-hidden="true">↗</span>
              </Link>
            );
          })}
      </nav>
      <div className="workspace-sidebar-bottom">
        <Link className="text-link" href="/workspaces">
          ← Switch workspace
        </Link>
        <SignOutButton />
        <small>Only the active organisation’s permitted resources are shown.</small>
      </div>
    </aside>
  );
}
