'use client';
import { useState } from 'react';
import type { Dashboard, Workspace, ActionInput } from '@/shared/contracts';
import { usePortalMutation, usePortalQuery } from './usePortalQuery';
import { EmptyState, Pager, Publication, QueryState } from './PortalUI';
const statuses = [
  'Proposed',
  'Under review',
  'Planned',
  'In progress',
  'Released',
  'Not proceeding',
] as const;
export function IdeasView({
  workspace,
  dashboard,
}: {
  workspace: Workspace;
  dashboard: Dashboard;
}) {
  const [page, setPage] = useState(0),
    [creating, setCreating] = useState(false);
  const query = usePortalQuery('ideas.list', workspace.id, { page, pageSize: 20 }),
    mutation = usePortalMutation(workspace.id);
  const canWrite = dashboard.capabilities.includes('ideas.write');
  return (
    <>
      {canWrite && (
        <div className="row">
          <button onClick={() => setCreating(!creating)}>
            {creating ? 'Close new idea' : '+ Propose an improvement'}
          </button>
          <p className="subtle-note">
            Creation and updates require an offering assignment and permitted evidence.
          </p>
        </div>
      )}
      {creating && (
        <CreateIdea
          workspace={workspace}
          dashboard={dashboard}
          done={() => {
            setCreating(false);
            query.refresh();
          }}
        />
      )}
      {mutation.message && (
        <p role="status" className={`message ${mutation.failed ? 'error' : ''}`}>
          {mutation.message}
        </p>
      )}
      {!query.data ? (
        <QueryState error={query.error} retry={query.refresh} />
      ) : (
        <>
          {!query.data.items.length && (
            <EmptyState title="No visible improvement ideas">
              Ideas appear when they have currently permitted supporting evidence. Withdrawn
              evidence is excluded.
            </EmptyState>
          )}
          {query.data.items.map((idea) => (
            <article className="panel" key={idea.id}>
              <div className="row between">
                <span className="badge">{idea.status}</span>
                <span className="index-label">{idea.priority} priority</span>
              </div>
              <h2>{idea.title}</h2>
              <h3>Problem</h3>
              <p className="prose">{idea.problem}</p>
              <h3>Proposed outcome</h3>
              <p className="prose">{idea.outcome}</p>
              <div className="metadata-row">
                <span>Owner/team: {idea.team}</span>
                <span>Updated {idea.updatedAt.slice(0, 10)}</span>
              </div>
              <details>
                <summary>Inspect approved supporting evidence</summary>
                {idea.evidence.map((item) => (
                  <Publication key={item.id} item={item} />
                ))}
              </details>
              {canWrite && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const status = String(
                      new FormData(e.currentTarget).get('status'),
                    ) as ActionInput<'ideas.update'>['status'];
                    void mutation.mutate(
                      'ideas.update',
                      { id: idea.id, status },
                      'Idea status updated.',
                      query.refresh,
                    );
                  }}
                >
                  <label htmlFor={`status-${idea.id}`}>Update status (assigned owner only)</label>
                  <div className="row">
                    <select
                      id={`status-${idea.id}`}
                      name="status"
                      defaultValue={idea.status}
                      key={idea.status}
                    >
                      {statuses.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                    <button disabled={mutation.busy}>Save status</button>
                  </div>
                </form>
              )}
            </article>
          ))}
          <Pager
            page={page}
            setPage={setPage}
            count={query.data.items.length}
            busy={mutation.busy}
          />
        </>
      )}
    </>
  );
}
function CreateIdea({
  workspace,
  dashboard,
  done,
}: {
  workspace: Workspace;
  dashboard: Dashboard;
  done: () => void;
}) {
  const [offering, setOffering] = useState(dashboard.offerings[0]?.id || ''),
    [page, setPage] = useState(0);
  const [validation, setValidation] = useState('');
  const evidence = usePortalQuery('learning.list', workspace.id, {
      offeringId: offering || undefined,
      page,
      pageSize: 20,
    }),
    mutation = usePortalMutation(workspace.id);
  if (!dashboard.offerings.length)
    return (
      <EmptyState title="No offering assignment available">
        An entitled offering and owner assignment are required.
      </EmptyState>
    );
  return (
    <section className="panel">
      <h2>Propose an improvement</h2>
      <p className="muted">
        All idea fields are shared with eligible readers. Exclude private tickets, internal roadmap
        discussions and delivery promises.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const selected = f.getAll('evidence').map(String);
          if (selected.length < 1 || selected.length > 20) {
            setValidation('Select between 1 and 20 currently approved contributions.');
            return;
          }
          setValidation('');
          void mutation.mutate(
            'ideas.create',
            {
              title: String(f.get('title')),
              problem: String(f.get('problem')),
              offeringId: offering,
              evidence: selected,
              outcome: String(f.get('outcome')),
              team: String(f.get('team')),
              priority: String(f.get('priority')) as 'low' | 'medium' | 'high',
            },
            'Improvement idea created.',
            done,
          );
        }}
      >
        {validation && (
          <p className="message error" role="alert">
            {validation}
          </p>
        )}
        <label htmlFor="idea-title">Title</label>
        <input id="idea-title" name="title" minLength={5} maxLength={160} required />
        <label htmlFor="idea-problem">Problem statement</label>
        <textarea id="idea-problem" name="problem" minLength={20} maxLength={3000} required />
        <label htmlFor="idea-offering">Offering</label>
        <select
          id="idea-offering"
          value={offering}
          onChange={(e) => {
            setOffering(e.target.value);
            setPage(0);
          }}
        >
          {dashboard.offerings.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title}
            </option>
          ))}
        </select>
        <label htmlFor="idea-outcome">Proposed outcome</label>
        <textarea id="idea-outcome" name="outcome" minLength={10} maxLength={2000} required />
        <div className="grid">
          <div>
            <label htmlFor="idea-team">Shared owner/team name</label>
            <input id="idea-team" name="team" required maxLength={120} />
          </div>
          <div>
            <label htmlFor="idea-priority">Priority</label>
            <select id="idea-priority" name="priority" defaultValue="medium">
              <option>low</option>
              <option>medium</option>
              <option>high</option>
            </select>
          </div>
        </div>
        <h3>Select supporting approved evidence</h3>
        <p className="subtle-note">
          Choose 1–20 contributions from the current page. Selections clear when changing page or
          offering.
        </p>
        {!evidence.data ? (
          <QueryState error={evidence.error} retry={evidence.refresh} />
        ) : (
          <div key={`${offering}/${page}`}>
            {evidence.data.items.map((item) => (
              <label className="inline-check" key={item.id}>
                <input type="checkbox" name="evidence" value={item.id} />
                <span>{item.title}</span>
              </label>
            ))}
            {!evidence.data.items.length && (
              <p className="muted">No approved evidence is available for this offering.</p>
            )}
            <Pager
              page={page}
              setPage={setPage}
              count={evidence.data.items.length}
              busy={mutation.busy}
            />
          </div>
        )}
        <button style={{ marginTop: 20 }} disabled={mutation.busy || !evidence.data?.items.length}>
          {mutation.busy ? 'Creating…' : 'Create proposed idea'}
        </button>
        {mutation.message && (
          <p role="status" className={`message ${mutation.failed ? 'error' : ''}`}>
            {mutation.message}
          </p>
        )}
      </form>
    </section>
  );
}
