import { redirect } from 'next/navigation';
import { portal } from '@/server/portal';
import { HttpError } from '@/server/http';
import { SignOutButton } from '@/components/core/SignOutButton';
import { WorkspacePicker } from '@/components/core/WorkspacePicker';
export const dynamic = 'force-dynamic';
export default async function Workspaces() {
  let items;
  try {
    items = (await portal('workspaces', null, {})).items;
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) redirect('/login');
    return (
      <>
        <h1>Workspace access is unavailable.</h1>
        <p className="muted">
          Configure Supabase and try again. Access requires a verified account and an approved
          membership.
        </p>
      </>
    );
  }
  return (
    <>
      <span className="eyebrow">Choose your context</span>
      <h1>Your workspaces</h1>
      <p className="muted">
        Select an organisation explicitly. Each request checks your current membership and
        entitlements.
      </p>
      <SignOutButton />
      <WorkspacePicker items={items} />
    </>
  );
}
