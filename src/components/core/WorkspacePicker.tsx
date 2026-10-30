'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { Workspace } from '@/shared/contracts';
export function WorkspacePicker({ items }: { items: Workspace[] }) {
  const [status, setStatus] = useState('');
  return (
    <>
      <div className="grid">
        {items.map((w) => (
          <Link
            href={`/workspace/${w.id}/dashboard`}
            key={w.id}
            className="panel"
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <span className="badge">{w.kind}</span>
            <h2>{w.name}</h2>
            <p className="muted">{w.role.replaceAll('_', ' ')} · Open workspace →</p>
          </Link>
        ))}
      </div>
      {!items.length && (
        <p className="message">
          No approved workspace memberships. Ask your organiser to approve access.
        </p>
      )}
      <section className="panel narrow">
        <h2>Accept an invitation</h2>
        <p className="muted">
          Use the invitation and organisation IDs provided by your administrator. You must be signed
          in as the intended verified account.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            try {
              const r = await fetch('/api/portal/invitations.accept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  workspaceId: f.get('workspace'),
                  payload: { id: f.get('invitation') },
                }),
              });
              const d = await r.json();
              if (!r.ok) throw new Error(d.error?.code);
              location.reload();
            } catch (e) {
              setStatus(e instanceof Error ? e.message : 'Acceptance failed');
            }
          }}
        >
          <label htmlFor="workspace">Organisation ID</label>
          <input name="workspace" id="workspace" required />
          <label htmlFor="invitation">Invitation ID</label>
          <input name="invitation" id="invitation" required />
          <button style={{ marginTop: 16 }}>Accept invitation</button>
        </form>
        {status && (
          <p role="alert" className="message error">
            {status}
          </p>
        )}
      </section>
    </>
  );
}
