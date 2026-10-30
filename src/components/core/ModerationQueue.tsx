'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ReviewItem } from '@/shared/contracts';
import { call } from '@/shared/client';
export function ModerationQueue({
  workspaceId,
  items,
}: {
  workspaceId: string;
  items: ReviewItem[];
}) {
  const router = useRouter(),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      setMessage('Review decision stored. An in-app notification is available to the author.');
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Review failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {message && (
        <p className="message" role="status">
          {message}
        </p>
      )}
      {!items.length && (
        <p className="message">
          No submitted sources available for your grants and entitlements. Private drafts do not
          appear here.
        </p>
      )}
      {items.map((o) => (
        <ReviewCard
          key={`${o.id}-${o.submitted_revision}-${o.state}`}
          item={o}
          workspaceId={workspaceId}
          busy={busy}
          run={run}
        />
      ))}
    </>
  );
}
function ReviewCard({
  item: o,
  workspaceId,
  busy,
  run,
}: {
  item: ReviewItem;
  workspaceId: string;
  busy: boolean;
  run: (fn: () => Promise<unknown>) => Promise<void>;
}) {
  const r = o.revision;
  const [note, setNote] = useState('');
  return (
    <section className="panel">
      <span className="badge">
        {o.state} · submitted revision {o.submitted_revision}
      </span>
      <h2>{r.title}</h2>
      <details>
        <summary>Private submitted source — authorised review only</summary>
        <p className="prose">{r.body}</p>
        <p className="muted">
          {r.offering_id} · {r.period_start} to {r.period_end} · {r.confidence} confidence
        </p>
      </details>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void run(() =>
            call('moderation.decide', workspaceId, {
              id: o.id,
              expectedRevision: o.submitted_revision,
              requestId: crypto.randomUUID(),
              decision: 'publish',
              note,
              title: String(f.get('title')),
              body: String(f.get('body')),
              topic: String(f.get('topic')),
              industry: String(f.get('industry')),
              region: String(f.get('region')),
              periodStart: String(f.get('periodStart')),
              periodEnd: String(f.get('periodEnd')),
              ...(f.get('attribution') ? { attribution: String(f.get('attribution')) } : {}),
            }),
          );
        }}
      >
        <h3>Reviewed shared representation</h3>
        <p className="muted">
          Remove identities and rare details. Review geography, dates and wording for
          re-identification risk. Only these reviewed fields enter shared learning.
        </p>
        <label htmlFor={`title-${o.id}`}>Shared title</label>
        <input
          id={`title-${o.id}`}
          name="title"
          defaultValue={r.title}
          required
          minLength={5}
          maxLength={160}
        />
        <label htmlFor={`body-${o.id}`}>Redacted shared text</label>
        <textarea
          id={`body-${o.id}`}
          name="body"
          defaultValue={r.body}
          required
          minLength={20}
          maxLength={6000}
        />
        <div className="grid">
          {(['topic', 'industry', 'region'] as const).map((k) => (
            <div key={k}>
              <label htmlFor={`${k}-${o.id}`}>{k}</label>
              <input id={`${k}-${o.id}`} name={k} defaultValue={r[k]} required maxLength={80} />
            </div>
          ))}
        </div>
        <div className="grid">
          <div>
            <label htmlFor={`start-${o.id}`}>Broad observation start</label>
            <input
              id={`start-${o.id}`}
              name="periodStart"
              type="date"
              defaultValue={r.period_start}
              required
            />
          </div>
          <div>
            <label htmlFor={`end-${o.id}`}>Broad observation end</label>
            <input
              id={`end-${o.id}`}
              name="periodEnd"
              type="date"
              defaultValue={r.period_end}
              required
            />
          </div>
        </div>
        {o.consent.attribution && (
          <>
            <label htmlFor={`attribution-${o.id}`}>Reviewed attribution (optional)</label>
            <input id={`attribution-${o.id}`} name="attribution" maxLength={120} />
          </>
        )}
        <label htmlFor={`note-${o.id}`}>Decision reason (visible to author)</label>
        <textarea
          id={`note-${o.id}`}
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          required
          minLength={1}
          maxLength={2000}
        />
        <div className="row" style={{ marginTop: 20 }}>
          {o.state === 'submitted' && (
            <>
              <button disabled={busy}>Publish this reviewed revision</button>
              {(['clarify', 'reject'] as const).map((decision) => (
                <button
                  key={decision}
                  type="button"
                  className="secondary"
                  disabled={busy || !note.trim()}
                  onClick={() =>
                    void run(() =>
                      call('moderation.decide', workspaceId, {
                        id: o.id,
                        expectedRevision: o.submitted_revision,
                        requestId: crypto.randomUUID(),
                        decision,
                        note,
                      }),
                    )
                  }
                >
                  {decision === 'clarify' ? 'Request clarification' : 'Reject'}
                </button>
              ))}
            </>
          )}
          {o.state === 'published' && (
            <button
              type="button"
              className="danger"
              disabled={busy || !note.trim()}
              onClick={() =>
                void run(() =>
                  call('moderation.decide', workspaceId, {
                    id: o.id,
                    expectedRevision: o.submitted_revision,
                    requestId: crypto.randomUUID(),
                    decision: 'suspend',
                    note,
                  }),
                )
              }
            >
              Temporarily unpublish
            </button>
          )}
          {['submitted', 'published'].includes(o.state) && (
            <button
              type="button"
              className="danger"
              disabled={busy || !note.trim()}
              onClick={() =>
                void run(() =>
                  call('moderation.decide', workspaceId, {
                    id: o.id,
                    expectedRevision: o.submitted_revision,
                    requestId: crypto.randomUUID(),
                    decision: 'withdraw',
                    note,
                  }),
                )
              }
            >
              Withdraw contribution
            </button>
          )}
        </div>
      </form>
      {o.reports.map((report) => (
        <div key={report.id} className="panel">
          <h3>Open contribution report</h3>
          <p className="prose">{report.reason}</p>
          <p className="muted">Use the decision reason above to record the resolution.</p>
          <div className="row">
            {[false, true].map((restore) => (
              <button
                key={String(restore)}
                type="button"
                className="secondary"
                disabled={busy || note.trim().length < 5}
                onClick={() =>
                  void run(() =>
                    call('reports.resolve', workspaceId, {
                      id: report.id,
                      requestId: crypto.randomUUID(),
                      note,
                      restore,
                    }),
                  )
                }
              >
                {restore ? 'Resolve and restore' : 'Resolve and keep unpublished'}
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
