'use client';
import { useState } from 'react';
import { actionSchemas } from '@/shared/contracts';
import { usePortalMutation, usePortalQuery } from './usePortalQuery';
import { QueryState } from './PortalUI';
const permissions = [
  'observations.write',
  'learning.read',
  'learning.report',
  'learning.moderate',
  'content.publish',
  'broadcast.publish',
  'members.manage',
  'ideas.write',
  'sandbox.run',
] as const;
export function Administration({ workspaceId }: { workspaceId: string }) {
  const organisations = usePortalQuery('admin.organisations', workspaceId, {}),
    audit = usePortalQuery('admin.audit', workspaceId, {}),
    mutation = usePortalMutation(workspaceId),
    [selected, setSelected] = useState('');
  return (
    <>
      <p className="message">
        Operational administration does not grant private observation access. Self-service privilege
        changes and platform-administrator delegation are blocked; initial identity verification and
        platform-admin provisioning remain organiser-controlled.
      </p>
      <details className="panel">
        <summary>Create a synthetic organisation</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void mutation.mutate(
              'admin.organisation.create',
              { name: String(f.get('name')), kind: String(f.get('kind')) as 'client' | 'employee' },
              'Synthetic organisation created.',
              () => {
                organisations.refresh();
                audit.refresh();
              },
            );
          }}
        >
          <label htmlFor="org-name">Name</label>
          <input id="org-name" name="name" maxLength={120} required />
          <label htmlFor="org-kind">Kind</label>
          <select id="org-kind" name="kind">
            <option value="client">Client</option>
            <option value="employee">Employee</option>
          </select>
          <button disabled={mutation.busy}>Create organisation</button>
        </form>
      </details>
      {mutation.message && (
        <p role="status" className={`message ${mutation.failed ? 'error' : ''}`}>
          {mutation.message}
        </p>
      )}
      {!organisations.data ? (
        <QueryState error={organisations.error} retry={organisations.refresh} />
      ) : (
        <>
          <label htmlFor="admin-organisation">Select organisation</label>
          <select
            id="admin-organisation"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Choose an organisation</option>
            {organisations.data.items.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} · {o.kind}
              </option>
            ))}
          </select>
          {selected && (
            <OrganisationControls
              key={selected}
              workspaceId={workspaceId}
              organisationId={selected}
              offerings={organisations.data.offerings}
              organisations={organisations.data.items}
              changed={audit.refresh}
            />
          )}
        </>
      )}
      <details className="panel">
        <summary>Recent audited operations</summary>
        {!audit.data ? (
          <QueryState error={audit.error} retry={audit.refresh} />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Actor ID</th>
                  <th>Resource ID</th>
                </tr>
              </thead>
              <tbody>
                {audit.data.items.map((a) => (
                  <tr key={a.id}>
                    <td>{a.created_at.slice(0, 19)}</td>
                    <td>{a.action}</td>
                    <td>{a.actor_id}</td>
                    <td>{a.resource_id || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </details>
    </>
  );
}
function OrganisationControls({
  workspaceId,
  organisationId,
  offerings,
  organisations,
  changed,
}: {
  workspaceId: string;
  organisationId: string;
  offerings: { id: string; title: string }[];
  organisations: { id: string; name: string }[];
  changed: () => void;
}) {
  const query = usePortalQuery('admin.members', workspaceId, { organisationId }),
    mutation = usePortalMutation(workspaceId),
    [error, setError] = useState('');
  const refresh = () => {
    query.refresh();
    changed();
  };
  if (!query.data) return <QueryState error={query.error} retry={query.refresh} />;
  return (
    <>
      <h2>Offering entitlements</h2>
      {offerings.map((o) => {
        const enabled = query.data!.entitlements.some((e) => e.offeringId === o.id && e.enabled);
        return (
          <div className="row publication-card" key={o.id}>
            <span>
              {o.title} · {enabled ? 'Enabled' : 'Disabled'}
            </span>
            <button
              className="secondary"
              disabled={mutation.busy}
              onClick={() =>
                void mutation.mutate(
                  'admin.entitlement',
                  { organisationId, offeringId: o.id, enabled: !enabled },
                  'Entitlement updated.',
                  refresh,
                )
              }
            >
              {enabled ? 'Disable' : 'Enable'}
            </button>
          </div>
        );
      })}
      <h2>Approved membership grants</h2>
      <p className="subtle-note">
        Existing verified accounts and approved memberships are provisioned through the organiser’s
        identity process. These controls manage grants separately.
      </p>
      {query.data.items.map((member) => (
        <article className="panel" key={member.id}>
          <span className="badge">
            {member.role.replaceAll('_', ' ')} ·{' '}
            {member.revoked ? 'Revoked' : member.approved ? 'Approved' : 'Pending'}
          </span>
          <p className="prose">{member.id}</p>
          <p className="muted">Grants: {member.capabilities.join(', ') || 'None'}</p>
          {member.approved && !member.revoked && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const parsed = actionSchemas['admin.grant'].safeParse({
                  requestId: crypto.randomUUID(),
                  organisationId,
                  userId: member.id,
                  capability: String(f.get('capability')),
                  enabled: f.get('enabled') === 'true',
                });
                if (!parsed.success) {
                  setError('Choose a valid capability.');
                  return;
                }
                setError('');
                const { requestId: _, ...payload } = parsed.data;
                void mutation.mutate('admin.grant', payload, 'Capability grant updated.', refresh);
              }}
            >
              <label htmlFor={`permission-${member.id}`}>Capability</label>
              <select id={`permission-${member.id}`} name="capability">
                {permissions.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
              <label htmlFor={`grant-state-${member.id}`}>Action</label>
              <select id={`grant-state-${member.id}`} name="enabled">
                <option value="true">Grant explicitly</option>
                <option value="false">Revoke grant</option>
              </select>
              <button disabled={mutation.busy}>Apply capability change</button>
            </form>
          )}
          {member.role === 'employee' && member.approved && !member.revoked && (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void mutation.mutate(
                    'admin.owner',
                    {
                      organisationId,
                      userId: member.id,
                      offeringId: String(f.get('offering')),
                      enabled: f.get('enabled') === 'true',
                    },
                    'Product-owner assignment updated.',
                    refresh,
                  );
                }}
              >
                <label htmlFor={`owner-offering-${member.id}`}>Product-owner offering</label>
                <select id={`owner-offering-${member.id}`} name="offering">
                  {offerings.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title}
                    </option>
                  ))}
                </select>
                <select name="enabled" aria-label="Owner assignment action">
                  <option value="true">Assign</option>
                  <option value="false">Unassign</option>
                </select>
                <button disabled={mutation.busy}>Update owner assignment</button>
              </form>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void mutation.mutate(
                    'admin.publisher',
                    {
                      organisationId,
                      userId: member.id,
                      targetWorkspace: String(f.get('target')),
                      enabled: f.get('enabled') === 'true',
                    },
                    'Publisher audience assignment updated.',
                    refresh,
                  );
                }}
              >
                <label htmlFor={`publisher-target-${member.id}`}>
                  Publisher target organisation
                </label>
                <select id={`publisher-target-${member.id}`} name="target">
                  {organisations.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
                <select name="enabled" aria-label="Publisher assignment action">
                  <option value="true">Assign</option>
                  <option value="false">Unassign</option>
                </select>
                <button disabled={mutation.busy}>Update publisher audience</button>
              </form>
            </>
          )}
        </article>
      ))}
      {error && (
        <p className="message error" role="alert">
          {error}
        </p>
      )}
      {mutation.message && (
        <p role="status" className={`message ${mutation.failed ? 'error' : ''}`}>
          {mutation.message}
        </p>
      )}
    </>
  );
}
