'use client';
import { useState } from 'react';
import type { Workspace } from '@/shared/contracts';
import { uuid } from '@/shared/contracts';
import { usePortalMutation, usePortalQuery } from './usePortalQuery';
import { EmptyState, QueryState } from './PortalUI';
export function MembersView({ workspace }: { workspace: Workspace }) {
  const query = usePortalQuery('members.list', workspace.id, {}),
    mutation = usePortalMutation(workspace.id);
  const [confirm, setConfirm] = useState<string | null>(null),
    [validation, setValidation] = useState('');
  return (
    <>
      {mutation.message && (
        <p role="status" className={`message ${mutation.failed ? 'error' : ''}`}>
          {mutation.message}
        </p>
      )}
      <section className="panel">
        <h2>Invite a verified client member</h2>
        <p className="muted">
          Ask your organiser for the intended account’s verified user ID. This preview stores a
          single-use invitation; it does not create an account or send invitation email.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const intendedUserId = String(new FormData(e.currentTarget).get('user')).trim();
            if (!uuid.safeParse(intendedUserId).success) {
              setValidation('Enter a valid verified account UUID.');
              return;
            }
            setValidation('');
            void mutation.mutate(
              'invitations.create',
              { intendedUserId, role: 'client_member' },
              'Invitation stored. No email was sent. Share the invitation and organisation IDs through your approved process.',
              query.refresh,
            );
          }}
        >
          <label htmlFor="invite-user">Intended verified account ID</label>
          <input id="invite-user" name="user" required maxLength={36} />
          <p className="subtle-note">
            Organisation: {workspace.name} · Role: client member · Expires in 48 hours
          </p>
          <button disabled={mutation.busy}>Store invitation</button>
          {validation && (
            <p className="message error" role="alert">
              {validation}
            </p>
          )}
        </form>
      </section>
      {!query.data ? (
        <QueryState error={query.error} retry={query.refresh} />
      ) : (
        <>
          <h2>Current members</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Account ID</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((member) => (
                  <tr key={member.id}>
                    <td>{member.id}</td>
                    <td>{member.role.replaceAll('_', ' ')}</td>
                    <td>
                      {member.revokedAt ? 'Revoked' : member.approved ? 'Approved' : 'Pending'}
                    </td>
                    <td>
                      {member.role === 'client_member' &&
                        !member.revokedAt &&
                        (confirm === member.id ? (
                          <div>
                            <p>Revoke this member’s access?</p>
                            <button
                              className="danger"
                              disabled={mutation.busy}
                              onClick={() =>
                                void mutation.mutate(
                                  'members.revoke',
                                  { id: member.id },
                                  'Client membership revoked.',
                                  () => {
                                    setConfirm(null);
                                    query.refresh();
                                  },
                                )
                              }
                            >
                              Confirm revocation
                            </button>
                            <button className="secondary" onClick={() => setConfirm(null)}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button className="secondary" onClick={() => setConfirm(member.id)}>
                            Revoke
                          </button>
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2>Invitations</h2>
          {!query.data.invitations.length && (
            <EmptyState title="No invitations stored">
              New invitations for this organisation will appear here.
            </EmptyState>
          )}
          {query.data.invitations.map((inv) => (
            <article className="publication-card" key={inv.id}>
              <span className="badge">
                {inv.acceptedAt
                  ? 'Accepted'
                  : new Date(inv.expiresAt).getTime() < Date.now()
                    ? 'Expired'
                    : 'Pending'}
              </span>
              <dl className="detail-list">
                <dt>Invitation ID</dt>
                <dd className="prose">{inv.id}</dd>
                <dt>Organisation ID</dt>
                <dd className="prose">{workspace.id}</dd>
                <dt>Intended verified account</dt>
                <dd className="prose">{inv.intendedUserId}</dd>
                <dt>Expires</dt>
                <dd>{inv.expiresAt.slice(0, 16).replace('T', ' ')} UTC</dd>
              </dl>
            </article>
          ))}
        </>
      )}
    </>
  );
}
