'use client';
import { usePortalMutation, usePortalQuery } from './usePortalQuery';
import { EmptyState, QueryState } from './PortalUI';
export function SavedRuns({ workspaceId }: { workspaceId: string }) {
  const query = usePortalQuery('sandbox.runs', workspaceId, {}),
    mutation = usePortalMutation(workspaceId);
  return (
    <section>
      <h2>Saved synthetic scenarios</h2>
      <p className="muted">
        Your saved runs are isolated to this account and workspace. Feedback does not train a model.
      </p>
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          void mutation.mutate(
            'sandbox.save',
            {
              name: String(new FormData(e.currentTarget).get('name')),
              offeringId: 'financial-analysis-intelligence',
            },
            'Synthetic scenario saved.',
            query.refresh,
          );
        }}
      >
        <label htmlFor="scenario-name">Save the fixed seasonality scenario as</label>
        <input id="scenario-name" name="name" maxLength={120} required />
        <button disabled={mutation.busy}>Run and save synthetic scenario</button>
      </form>
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
            <EmptyState title="No saved scenarios yet">
              Save a named synthetic seasonality run to revisit its inputs and explanation.
            </EmptyState>
          )}
          {query.data.items.map((run) => (
            <article className="panel" key={run.id}>
              <span className="badge">Synthetic · Simulated</span>
              <h3>{run.name}</h3>
              <p>{run.result.message}</p>
              <p className="muted">
                Quarterly values: {run.result.inputs.quarterlyValues.join(' · ')}
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void mutation.mutate(
                    'sandbox.feedback',
                    {
                      id: run.id,
                      rating: String(f.get('rating')) as 'useful' | 'needs_context',
                      feedback: String(f.get('feedback')),
                    },
                    'Feedback saved.',
                    query.refresh,
                  );
                }}
              >
                <label htmlFor={`rating-${run.id}`}>Was this explanation useful?</label>
                <select id={`rating-${run.id}`} name="rating" defaultValue={run.rating || 'useful'}>
                  <option value="useful">Useful</option>
                  <option value="needs_context">Needs more context</option>
                </select>
                <label htmlFor={`feedback-${run.id}`}>Synthetic scenario feedback</label>
                <textarea
                  id={`feedback-${run.id}`}
                  name="feedback"
                  maxLength={1000}
                  defaultValue={run.feedback || ''}
                />
                <button disabled={mutation.busy}>Save feedback</button>
              </form>
            </article>
          ))}
        </>
      )}
    </section>
  );
}
