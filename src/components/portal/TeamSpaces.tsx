'use client';
import { useState } from 'react';
import { uuid } from '@/shared/contracts';
import { usePortalMutation, usePortalQuery } from './usePortalQuery';
import { EmptyState, QueryState } from './PortalUI';
export function TeamSpaces({ workspaceId }: { workspaceId: string }) {
  const query = usePortalQuery('teams.list', workspaceId, {}),
    mutation = usePortalMutation(workspaceId),
    [selected, setSelected] = useState('');
  return (
    <>
      <details className="panel">
        <summary>Create an employee hackathon team</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void mutation.mutate(
              'teams.create',
              { name: String(f.get('name')), description: String(f.get('description')) },
              'Team space created.',
              query.refresh,
            );
          }}
        >
          <label htmlFor="team-name">Team name</label>
          <input id="team-name" name="name" required minLength={3} maxLength={100} />
          <label htmlFor="team-description">Purpose</label>
          <textarea
            id="team-description"
            name="description"
            required
            minLength={10}
            maxLength={2000}
          />
          <button disabled={mutation.busy}>Create team</button>
        </form>
      </details>
      {mutation.message && (
        <p className={`message ${mutation.failed ? 'error' : ''}`} role="status">
          {mutation.message}
        </p>
      )}
      {!query.data ? (
        <QueryState error={query.error} retry={query.refresh} />
      ) : (
        <>
          {!query.data.items.length && (
            <EmptyState title="No team memberships">
              Create an employee team or ask its owner to add your approved employee account.
            </EmptyState>
          )}
          <div className="row">
            {query.data.items.map((t) => (
              <button
                className="secondary"
                key={t.id}
                onClick={() => setSelected(t.id)}
                aria-pressed={selected === t.id}
              >
                {t.name} {t.owner ? '· Owner' : ''}
              </button>
            ))}
          </div>
        </>
      )}
      {selected && <TeamDetail key={selected} workspaceId={workspaceId} id={selected} />}
    </>
  );
}
function TeamDetail({ workspaceId, id }: { workspaceId: string; id: string }) {
  const query = usePortalQuery('teams.get', workspaceId, { id }),
    mutation = usePortalMutation(workspaceId),
    [error, setError] = useState('');
  if (!query.data) return <QueryState error={query.error} retry={query.refresh} />;
  const team = query.data;
  return (
    <section className="panel">
      <h2>{team.name}</h2>
      <p>{team.description}</p>
      <p className="subtle-note">
        Only current members of this employee team can read these posts. Keep client-private records
        out of team discussions.
      </p>
      {team.posts.map((p) => (
        <article className="publication-card" key={p.id}>
          <span className="index-label">
            {p.own ? 'You' : 'Team member'} · {p.createdAt.slice(0, 10)}
          </span>
          <p className="prose">{p.body}</p>
        </article>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          void mutation.mutate(
            'teams.post',
            { id, body: String(new FormData(form).get('body')) },
            'Team post saved.',
            () => {
              form.reset();
              query.refresh();
            },
          );
        }}
      >
        <label htmlFor="team-post">Add a synthetic project update</label>
        <textarea id="team-post" name="body" required minLength={5} maxLength={3000} />
        <button disabled={mutation.busy}>Post to team</button>
      </form>
      <details>
        <summary>Team members</summary>
        {team.members.map((m) => (
          <div className="row" key={m.id}>
            <span className="subtle-note">
              {m.id}
              {m.owner ? ' · Owner' : ''}
            </span>
            {team.owner && !m.owner && (
              <button
                className="secondary"
                disabled={mutation.busy}
                onClick={() =>
                  void mutation.mutate(
                    'teams.remove',
                    { id, userId: m.id },
                    'Team membership removed.',
                    query.refresh,
                  )
                }
              >
                Remove from team
              </button>
            )}
          </div>
        ))}
        {team.owner && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const userId = String(new FormData(e.currentTarget).get('user')).trim();
              if (!uuid.safeParse(userId).success) {
                setError('Enter a verified employee account UUID.');
                return;
              }
              setError('');
              void mutation.mutate(
                'teams.add',
                { id, userId },
                'Employee added to this team.',
                query.refresh,
              );
            }}
          >
            <label htmlFor="team-user">Add an approved employee account ID</label>
            <input id="team-user" name="user" required maxLength={36} />
            <button disabled={mutation.busy}>Add team member</button>
          </form>
        )}
      </details>
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
    </section>
  );
}
