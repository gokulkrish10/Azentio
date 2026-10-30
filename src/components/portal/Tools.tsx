'use client';
import { useEffect, useRef, useState } from 'react';
import type { AiraResult, Dashboard, Workspace, ActionOutput } from '@/shared/contracts';
import { call } from '@/shared/client';
import { airaInput } from '@/shared/contracts';
import { EmptyState, Publication } from './PortalUI';
import { friendlyError } from './usePortalQuery';
import { SavedRuns } from './SavedRuns';
export function Playground({
  workspace,
  dashboard,
}: {
  workspace: Workspace;
  dashboard: Dashboard;
}) {
  const [result, setResult] = useState<ActionOutput['sandbox.run'] | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const supportedOfferings = dashboard.offerings.filter(
    (o) => o.id === 'financial-analysis-intelligence',
  );
  if (!supportedOfferings.length)
    return (
      <EmptyState title="No sandbox offerings assigned">
        This preview supports the Financial Analysis Intelligence seasonality scenario. Its offering
        entitlement and sandbox permission are both required.
      </EmptyState>
    );
  return (
    <>
      <section className="panel">
        <span className="badge">Synthetic · Deterministic · Simulated</span>
        <h2>Seasonal SME cash-flow comparison</h2>
        <p className="muted">
          Inspect four illustrative quarterly values, then run the entitled scenario to see a
          comparison explanation. This does not call a lending model.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            setResult(null);
            const offeringId = String(new FormData(e.currentTarget).get('offering'));
            try {
              setResult(
                await call('sandbox.run', workspace.id, { offeringId, scenario: 'seasonal-sme' }),
              );
            } catch (error) {
              setError(friendlyError(error));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label htmlFor="sandbox-offering">Entitled offering</label>
          <select
            id="sandbox-offering"
            name="offering"
            disabled={busy}
            onChange={() => setResult(null)}
          >
            {supportedOfferings.map((o) => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </select>
          <p className="subtle-note">
            Fixed synthetic input: Q1 80 · Q2 120 · Q3 160 · Q4 100. Values are illustrative units,
            not client financial data.
          </p>
          <button disabled={busy}>{busy ? 'Running…' : 'Run synthetic scenario →'}</button>
        </form>
      </section>
      {error && (
        <p role="alert" className="message error">
          {error}
        </p>
      )}
      {result && (
        <section className="panel" role="status">
          <h2>Simulated output</h2>
          <p>{result.message}</p>
          <div className="scenario-values" aria-label="Synthetic quarterly values">
            {result.inputs.quarterlyValues.map((v, i) => (
              <div className="scenario-bar" key={i}>
                <div style={{ height: `${v / 2}px` }}>{v}</div>
                <span>Q{i + 1}</span>
              </div>
            ))}
          </div>
          <p className="muted">
            This quick run is temporary. Use the named scenario form below to save a separate run
            and provide feedback. Uploads are not supported.
          </p>
        </section>
      )}
      <SavedRuns workspaceId={workspace.id} />
    </>
  );
}
export function Assistant({ workspace }: { workspace: Workspace }) {
  const [result, setResult] = useState<AiraResult | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const sequence = useRef(0);
  useEffect(() => {
    const hide = () => {
      sequence.current++;
      setResult(null);
      setBusy(false);
    };
    document.addEventListener('visibilitychange', hide);
    const timer = setInterval(hide, 30000);
    return () => {
      sequence.current++;
      document.removeEventListener('visibilitychange', hide);
      clearInterval(timer);
    };
  }, []);
  return (
    <>
      <section className="panel">
        <span className="eyebrow">Evidence before answers</span>
        <h2>What would you like to understand?</h2>
        <p className="muted">
          AIRA uses a bounded set of recent approved contributions. Ask about shared observations
          and exclude private data from your question.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const question = String(new FormData(e.currentTarget).get('question'));
            const parsed = airaInput.safeParse({ workspaceId: workspace.id, question });
            if (!parsed.success) {
              setError('Enter a question between 5 and 500 characters.');
              return;
            }
            const current = ++sequence.current;
            setBusy(true);
            setResult(null);
            setError('');
            try {
              const response = await fetch('/api/aira', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsed.data),
                cache: 'no-store',
              });
              const data = await response.json();
              if (!response.ok) throw new Error(data.error?.code);
              if (!['answered', 'insufficient_evidence', 'unavailable'].includes(data.status))
                throw new Error('INVALID_RESPONSE');
              if (current === sequence.current) setResult(data as AiraResult);
            } catch (error) {
              if (current === sequence.current) setError(friendlyError(error));
            } finally {
              if (current === sequence.current) setBusy(false);
            }
          }}
        >
          <label htmlFor="aira-question">Your question</label>
          <textarea
            id="aira-question"
            name="question"
            minLength={5}
            maxLength={500}
            required
            disabled={busy}
            placeholder="What does the approved evidence say about seasonal cash-flow comparisons?"
          />
          <button disabled={busy}>{busy ? 'Reviewing permitted evidence…' : 'Ask AIRA →'}</button>
        </form>
        <p className="subtle-note">
          Answers are temporary and clear within 30 seconds or when leaving this tab. They are not
          saved as themes or model training.
        </p>
      </section>
      {error && (
        <p role="alert" className="message error">
          {error}
        </p>
      )}
      {result && (
        <section className="assistant-answer" aria-live="polite">
          {result.status === 'answered' ? (
            <>
              <h2>Answer with evidence</h2>
              {result.answer.statements.map((statement, i) => (
                <div key={i}>
                  <p>{statement.text}</p>
                  <ul className="citation-list">
                    {statement.citations.map((id) => (
                      <li key={id}>
                        <a href={`#evidence-${id}`}>
                          {result.evidence.find((e) => e.id === id)?.title ||
                            'Supporting approved evidence'}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="message">{result.answer.uncertainty}</p>
              <h3>Approved supporting contributions</h3>
              {result.evidence.map((item) => (
                <Publication key={item.id} item={item} />
              ))}
            </>
          ) : (
            <EmptyState
              title={
                result.status === 'unavailable'
                  ? 'AIRA is currently unavailable'
                  : 'There isn’t enough grounded evidence'
              }
            >
              {result.message}
            </EmptyState>
          )}
        </section>
      )}
    </>
  );
}
