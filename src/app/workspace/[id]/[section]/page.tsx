import { notFound } from 'next/navigation';
import { portal } from '@/server/portal';
import { PortalSection } from '@/components/portal/PortalSection';
const sections = [
  'dashboard',
  'administration',
  'library',
  'teams',
  'learning',
  'bookmarks',
  'themes',
  'ideas',
  'notifications',
  'playground',
  'members',
  'assistant',
] as const;
export default async function WorkspaceSection({
  params,
}: {
  params: Promise<{ id: string; section: string }>;
}) {
  const { id, section } = await params;
  if (!sections.includes(section as (typeof sections)[number])) notFound();
  try {
    const dashboard = await portal('dashboard', id, {});
    const workspace = (await portal('workspaces', null, {})).items.find((w) => w.id === id);
    if (!workspace) return <p className="message error">Workspace unavailable.</p>;
    return (
      <PortalSection
        key={`${id}/${section}`}
        section={section as (typeof sections)[number]}
        workspace={workspace}
        dashboard={dashboard}
      />
    );
  } catch {
    return (
      <p role="alert" className="message error">
        This workspace is unavailable. Return to the workspace picker or try again.
      </p>
    );
  }
}
