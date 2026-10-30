'use client';
import { useState } from 'react';
import type { ActionInput, Dashboard, Workspace } from '@/shared/contracts';
import { usePortalMutation, usePortalQuery } from './usePortalQuery';
import { EmptyState, Publication, QueryState } from './PortalUI';

export function SavedSearches({
  workspaceId,
  filters,
  apply,
}: {
  workspaceId: string;
  filters: ActionInput<'searches.save'>['filters'];
  apply: (filters: ActionInput<'searches.save'>['filters']) => void;
}) {
  const query = usePortalQuery('searches.list', workspaceId, {}),
    mutation = usePortalMutation(workspaceId);
  return (
    <details className="panel">
      <summary>Saved searches</summary>
      <p className="subtle-note">
        Names and filters are saved for you in this workspace. Results are always checked against
        current permissions.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const name = String(new FormData(e.currentTarget).get('name'));
          void mutation.mutate('searches.save', { name, filters }, 'Search saved.', query.refresh);
        }}
      >
        <label htmlFor="save-search-name">Name this search</label>
        <input id="save-search-name" name="name" required maxLength={80} />
        <button disabled={mutation.busy}>Save current filters</button>
      </form>
      {mutation.message && (
        <p role="status" className={`message ${mutation.failed ? 'error' : ''}`}>
          {mutation.message}
        </p>
      )}
      {!query.data ? (
        <QueryState error={query.error} retry={query.refresh} />
      ) : (
        query.data.items.map((s) => (
          <div className="row" key={s.id}>
            <button className="secondary" onClick={() => apply(s.filters)}>
              {s.name} →
            </button>
            <button
              className="secondary"
              disabled={mutation.busy}
              onClick={() =>
                void mutation.mutate(
                  'searches.delete',
                  { id: s.id },
                  'Saved search removed.',
                  query.refresh,
                )
              }
            >
              Remove
            </button>
          </div>
        ))
      )}
    </details>
  );
}
export function BookmarkButton({
  workspaceId,
  id,
  saved,
  refresh,
}: {
  workspaceId: string;
  id: string;
  saved: boolean;
  refresh: () => void;
}) {
  const mutation = usePortalMutation(workspaceId);
  return (
    <>
      <button
        className="secondary"
        disabled={mutation.busy}
        aria-pressed={saved}
        onClick={() =>
          void mutation.mutate(
            'bookmarks.set',
            { id, saved: !saved },
            saved ? 'Bookmark removed.' : 'Bookmarked.',
            refresh,
          )
        }
      >
        {saved ? '★ Saved' : '☆ Bookmark'}
      </button>
      {mutation.message && (
        <p role="status" className={`message ${mutation.failed ? 'error' : ''}`}>
          {mutation.message}
        </p>
      )}
    </>
  );
}
export function BookmarksView({
  workspace,
  dashboard,
}: {
  workspace: Workspace;
  dashboard: Dashboard;
}) {
  const query = usePortalQuery('bookmarks.list', workspace.id, {});
  if (!query.data) return <QueryState error={query.error} retry={query.refresh} />;
  return (
    <>
      {!query.data.items.length && (
        <EmptyState title="No available bookmarks">
          Save approved contributions from shared learning. Withdrawn or no-longer-permitted records
          disappear automatically.
        </EmptyState>
      )}
      {query.data.items.map((item) => (
        <Publication key={item.id} item={item}>
          <BookmarkButton workspaceId={workspace.id} id={item.id} saved refresh={query.refresh} />
          <PublicationDiscussion workspace={workspace} dashboard={dashboard} id={item.id} />
        </Publication>
      ))}
    </>
  );
}
export function PublicationDiscussion({
  workspace,
  dashboard,
  id,
}: {
  workspace: Workspace;
  dashboard: Dashboard;
  id: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Discussion and evidence quality</summary>
      {open && <Discussion workspace={workspace} dashboard={dashboard} id={id} />}
    </details>
  );
}
function Discussion({
  workspace,
  dashboard,
  id,
}: {
  workspace: Workspace;
  dashboard: Dashboard;
  id: string;
}) {
  const comments = usePortalQuery('comments.list', workspace.id, { id }),
    quality = usePortalQuery('quality.get', workspace.id, { id }),
    mutation = usePortalMutation(workspace.id);
  const refresh = () => {
    comments.refresh();
    quality.refresh();
  };
  return (
    <>
      <p className="subtle-note">
        Comments are proposed for review before community publication. Use synthetic wording without
        client identities or restricted information.
      </p>
      {quality.data?.assessment && (
        <p className="message">
          Reviewer assessment: {quality.data.assessment.quality.replaceAll('_', ' ')}.{' '}
          {quality.data.assessment.reason}
        </p>
      )}
      <div className="row">
        {(['useful', 'needs_evidence'] as const).map((assessment) => (
          <button
            key={assessment}
            className="secondary"
            disabled={mutation.busy}
            aria-pressed={quality.data?.yourFeedback === assessment}
            onClick={() =>
              void mutation.mutate(
                'feedback.set',
                { id, assessment },
                'Your feedback was recorded.',
                quality.refresh,
              )
            }
          >
            {assessment.replaceAll('_', ' ')}
          </button>
        ))}
      </div>
      {dashboard.capabilities.includes('learning.moderate') && (
        <details>
          <summary>Record reviewer evidence assessment</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void mutation.mutate(
                'quality.set',
                {
                  id,
                  quality: String(f.get('quality')) as 'strong' | 'limited' | 'needs_evidence',
                  reason: String(f.get('reason')),
                },
                'Reviewed evidence assessment saved.',
                quality.refresh,
              );
            }}
          >
            <label htmlFor={`quality-${id}`}>Evidence quality</label>
            <select id={`quality-${id}`} name="quality">
              <option value="limited">Limited</option>
              <option value="strong">Strong</option>
              <option value="needs_evidence">Needs evidence</option>
            </select>
            <label htmlFor={`quality-reason-${id}`}>Shared, reviewed reason</label>
            <textarea
              id={`quality-reason-${id}`}
              name="reason"
              minLength={5}
              maxLength={1000}
              required
            />
            <button disabled={mutation.busy}>Save reviewed assessment</button>
          </form>
        </details>
      )}
      {!comments.data ? (
        <QueryState error={comments.error} retry={comments.refresh} />
      ) : (
        comments.data.items.map((c) => (
          <article className="publication-card" key={c.id}>
            <span className="badge">
              {c.own ? 'Your comment' : 'Reviewed community comment'} · {c.state}
            </span>
            <p className="prose">{c.body}</p>
            {c.decision && <p className="muted">Review reason: {c.decision}</p>}
            {c.own ? (
              <button
                className="secondary"
                disabled={mutation.busy}
                onClick={() =>
                  void mutation.mutate(
                    'comments.withdraw',
                    { id: c.id },
                    'Comment withdrawn.',
                    refresh,
                  )
                }
              >
                Withdraw comment
              </button>
            ) : (
              dashboard.capabilities.includes('learning.report') && (
                <details>
                  <summary>Report this comment</summary>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void mutation.mutate(
                        'comments.report',
                        { id: c.id, reason: String(new FormData(e.currentTarget).get('reason')) },
                        'Comment reported and temporarily hidden for review.',
                        refresh,
                      );
                    }}
                  >
                    <label htmlFor={`comment-report-${c.id}`}>Reason</label>
                    <textarea
                      id={`comment-report-${c.id}`}
                      name="reason"
                      minLength={5}
                      maxLength={1000}
                      required
                    />
                    <button disabled={mutation.busy}>Report comment</button>
                  </form>
                </details>
              )
            )}
          </article>
        ))
      )}
      {dashboard.capabilities.includes('observations.write') && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            void mutation.mutate(
              'comments.create',
              { id, body: String(new FormData(form).get('body')), publicationConsent: true },
              'Comment submitted for review.',
              () => {
                form.reset();
                comments.refresh();
              },
            );
          }}
        >
          <label htmlFor={`comment-${id}`}>Propose a comment</label>
          <textarea id={`comment-${id}`} name="body" minLength={5} maxLength={2000} required />
          <label className="check">
            <input type="checkbox" required />I permit a reviewed copy of this comment to be shared
            with the parent contribution’s authorised audience.
          </label>
          <button disabled={mutation.busy}>Submit comment for review</button>
        </form>
      )}
      {mutation.message && (
        <p role="status" className={`message ${mutation.failed ? 'error' : ''}`}>
          {mutation.message}
        </p>
      )}
    </>
  );
}
export function CommentReview({ workspaceId }: { workspaceId: string }) {
  const query = usePortalQuery('comments.queue', workspaceId, {}),
    mutation = usePortalMutation(workspaceId);
  return (
    <section>
      <h2>Review community comments</h2>
      <p className="muted">
        Review proposed wording and reported comments. The original comment is shown only for
        authorised moderation.
      </p>
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
            <EmptyState title="No comments to review">
              Only comments on currently permitted approved publications appear here.
            </EmptyState>
          )}
          {query.data.items.map((c) => (
            <form
              className="panel"
              key={c.id}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget),
                  decision = String(f.get('decision')) as 'publish' | 'reject';
                void mutation.mutate(
                  'comments.review',
                  { id: c.id, decision, body: String(f.get('body')), note: String(f.get('note')) },
                  'Comment review recorded.',
                  query.refresh,
                );
              }}
            >
              <span className="badge">{c.state}</span>
              <h3>{c.publicationTitle}</h3>
              <details>
                <summary>Original proposed comment</summary>
                <p className="prose">{c.body}</p>
              </details>
              {c.reports.map((reason, i) => (
                <p className="message" key={i}>
                  Reported concern: {reason}
                </p>
              ))}
              <label htmlFor={`review-comment-${c.id}`}>Reviewed shared text</label>
              <textarea
                id={`review-comment-${c.id}`}
                name="body"
                defaultValue={c.body}
                minLength={5}
                maxLength={2000}
                required
              />
              <label htmlFor={`review-note-${c.id}`}>Reason visible to the author</label>
              <textarea
                id={`review-note-${c.id}`}
                name="note"
                minLength={1}
                maxLength={1000}
                required
              />
              <label htmlFor={`decision-${c.id}`}>Decision</label>
              <select name="decision" id={`decision-${c.id}`}>
                <option value="publish">Publish reviewed copy</option>
                <option value="reject">Reject / unpublish</option>
              </select>
              <button disabled={mutation.busy}>Record decision</button>
            </form>
          ))}
        </>
      )}
    </section>
  );
}
