'use client';
import { useState } from 'react';
import type { ActionInput, ContentItem, Dashboard, Workspace } from '@/shared/contracts';
import { actionSchemas } from '@/shared/contracts';
import { EmptyState, QueryState } from './PortalUI';
import { usePortalMutation, usePortalQuery } from './usePortalQuery';
export function ContentLibrary({
  workspace,
  dashboard,
}: {
  workspace: Workspace;
  dashboard: Dashboard;
}) {
  const [kind, setKind] = useState(''),
    [editing, setEditing] = useState<ContentItem | 'new' | null>(null);
  const query = usePortalQuery('content.list', workspace.id, {
    ...(kind ? { kind: kind as ContentItem['kind'] } : {}),
  });
  const canCreate =
    workspace.kind === 'employee' &&
    dashboard.capabilities.some((c) =>
      ['content.publish', 'broadcast.publish', 'observations.write'].includes(c),
    );
  return (
    <>
      <div className="filter-form">
        <label htmlFor="library-kind">Content type</label>
        <select id="library-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">All available content</option>
          <option value="session">Sessions and recordings</option>
          <option value="resource">Knowledge resources</option>
          <option value="release_note">Release notes</option>
          {workspace.kind === 'employee' && (
            <option value="experiment">Employee experiments</option>
          )}
        </select>
      </div>
      {canCreate && (
        <button onClick={() => setEditing(editing ? null : 'new')}>
          {editing ? 'Close editor' : '+ Create content'}
        </button>
      )}
      {editing && (
        <ContentEditor
          key={editing === 'new' ? 'new' : editing.id}
          workspace={workspace}
          dashboard={dashboard}
          item={editing === 'new' ? undefined : editing}
          done={() => {
            setEditing(null);
            query.refresh();
          }}
        />
      )}
      {!query.data ? (
        <QueryState error={query.error} retry={query.refresh} />
      ) : (
        <>
          {!query.data.items.length && (
            <EmptyState title="No available content">
              Your organisation’s entitled sessions, resources and release notes will appear here
              once published. Employee experiments are never available in client workspaces.
            </EmptyState>
          )}
          {query.data.items.map((item) => (
            <ContentCard
              key={`${item.id}/${item.revision}`}
              item={item}
              workspace={workspace}
              refresh={query.refresh}
              edit={() => setEditing(item)}
            />
          ))}
        </>
      )}
    </>
  );
}
function ContentEditor({
  workspace,
  dashboard,
  item,
  done,
}: {
  workspace: Workspace;
  dashboard: Dashboard;
  item?: ContentItem;
  done: () => void;
}) {
  const mutation = usePortalMutation(workspace.id),
    [error, setError] = useState('');
  const kinds: ContentItem['kind'][] = [];
  if (dashboard.capabilities.includes('content.publish')) kinds.push('resource', 'release_note');
  if (dashboard.capabilities.includes('broadcast.publish')) kinds.push('session');
  if (dashboard.capabilities.includes('observations.write')) kinds.push('experiment');
  if (item && !kinds.includes(item.kind)) kinds.push(item.kind);
  const [selected, setSelected] = useState<ContentItem['kind']>(
    item?.kind || kinds[0] || 'experiment',
  );
  return (
    <section className="panel">
      <h2>{item ? 'Edit content as a new draft' : 'Create a draft'}</h2>
      <p className="muted">
        Use synthetic content only. Editing published content immediately removes its published
        version until a publisher republishes it. Experiments must be submitted before another
        employee publisher can review them.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const startsAt = String(f.get('startsAt') || '');
          const payload = {
            kind: selected,
            title: String(f.get('title')),
            body: String(f.get('body')),
            audience: selected === 'experiment' ? 'employee' : String(f.get('audience')),
            ownerTeam: String(f.get('ownerTeam')),
            reviewDate: String(f.get('reviewDate')),
            ...(f.get('targetWorkspace')
              ? { targetWorkspace: String(f.get('targetWorkspace')).trim() }
              : {}),
            ...(f.get('offeringId') ? { offeringId: String(f.get('offeringId')) } : {}),
            ...(startsAt ? { startsAt: new Date(startsAt).toISOString() } : {}),
            ...(item ? { id: item.id, expectedRevision: item.revision } : {}),
            requestId: crypto.randomUUID(),
          };
          const parsed = actionSchemas['content.save'].safeParse(payload);
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message || 'Check the form.');
            return;
          }
          setError('');
          const { requestId: _, ...values } = parsed.data;
          void mutation.mutate('content.save', values, 'Draft saved.', done);
        }}
      >
        <label htmlFor="content-kind">Type</label>
        <select
          id="content-kind"
          value={selected}
          disabled={!!item}
          onChange={(e) => setSelected(e.target.value as ContentItem['kind'])}
        >
          {kinds.map((k) => (
            <option key={k} value={k}>
              {k.replaceAll('_', ' ')}
            </option>
          ))}
        </select>
        <label htmlFor="content-title">Title</label>
        <input
          id="content-title"
          name="title"
          required
          minLength={5}
          maxLength={160}
          defaultValue={item?.title}
        />
        <label htmlFor="content-body">Content / experiment proposal</label>
        <textarea
          id="content-body"
          name="body"
          required
          minLength={20}
          maxLength={12000}
          defaultValue={item?.body}
        />
        {selected !== 'experiment' && (
          <>
            <label htmlFor="content-audience">Audience</label>
            <select
              id="content-audience"
              name="audience"
              defaultValue={item?.audience || 'employee'}
            >
              <option value="employee">Employee workspace</option>
              <option value="organisation">One approved organisation</option>
              <option value="public">Public website</option>
            </select>
            <label htmlFor="content-target">Target organisation ID (optional)</label>
            <input
              id="content-target"
              name="targetWorkspace"
              defaultValue={item?.targetWorkspace || ''}
            />
            <p className="subtle-note">
              Blank uses the active workspace. Publishing to another organisation requires an
              organiser-provisioned publisher assignment. Public content does not use a target
              organisation.
            </p>
          </>
        )}
        <label htmlFor="content-offering">Offering entitlement</label>
        <select id="content-offering" name="offeringId" defaultValue={item?.offeringId || ''}>
          <option value="">General resource</option>
          {dashboard.offerings.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title}
            </option>
          ))}
        </select>
        <div className="grid">
          <div>
            <label htmlFor="owner-team">Owner/team</label>
            <input
              id="owner-team"
              name="ownerTeam"
              maxLength={120}
              required
              defaultValue={item?.ownerTeam}
            />
          </div>
          <div>
            <label htmlFor="review-date">Review date</label>
            <input
              id="review-date"
              type="date"
              name="reviewDate"
              required
              defaultValue={item?.reviewDate}
            />
          </div>
        </div>
        {selected === 'session' && (
          <>
            <label htmlFor="starts-at">Session start (your local time)</label>
            <input
              id="starts-at"
              name="startsAt"
              type="datetime-local"
              defaultValue={
                item?.startsAt
                  ? new Date(
                      new Date(item.startsAt).getTime() -
                        new Date(item.startsAt).getTimezoneOffset() * 60000,
                    )
                      .toISOString()
                      .slice(0, 16)
                  : ''
              }
            />
          </>
        )}
        <button disabled={mutation.busy}>Save draft</button>
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
      </form>
    </section>
  );
}
export function ContentCard({
  item,
  workspace,
  refresh,
  edit,
}: {
  item: ContentItem;
  workspace: Workspace;
  refresh: () => void;
  edit: () => void;
}) {
  const mutation = usePortalMutation(workspace.id),
    [uploadBusy, setUploadBusy] = useState(false),
    [uploadStatus, setUploadStatus] = useState('');
  const url = `/api/content/${item.id}/media?workspaceId=${workspace.id}`;
  return (
    <article className="panel">
      <div className="row">
        <span className="badge">
          {item.kind.replaceAll('_', ' ')} · {item.state}
        </span>
        <span className="index-label">{item.audience}</span>
      </div>
      <h2>{item.title}</h2>
      <p className="prose">{item.body}</p>
      <div className="metadata-row">
        <span>Owner: {item.ownerTeam}</span>
        <span>Review: {item.reviewDate}</span>
        {item.startsAt && <span>Session: {new Date(item.startsAt).toLocaleString()}</span>}
        <span>Revision {item.revision}</span>
      </div>
      {item.hasMedia && (
        <div>
          {item.mediaType !== 'application/pdf' && (
            <video controls preload="none" style={{ width: '100%', maxHeight: 420 }} src={url} />
          )}
          <a className="text-link" href={url}>
            Open attached recording or PDF ↗
          </a>
        </div>
      )}
      <div className="row">
        {item.canEdit && item.state !== 'withdrawn' && (
          <button className="secondary" onClick={edit}>
            Edit as draft
          </button>
        )}
        {item.canEdit && item.kind === 'experiment' && item.state === 'draft' && (
          <button
            disabled={mutation.busy}
            onClick={() =>
              void mutation.mutate(
                'content.submit',
                { id: item.id, expectedRevision: item.revision },
                'Experiment submitted for publisher review.',
                refresh,
              )
            }
          >
            Submit experiment
          </button>
        )}
        {item.canPublish && ['draft', 'submitted'].includes(item.state) && (
          <button
            disabled={mutation.busy}
            onClick={() =>
              void mutation.mutate(
                'content.publish',
                { id: item.id, expectedRevision: item.revision },
                'Content published to its configured audience.',
                refresh,
              )
            }
          >
            Publish
          </button>
        )}
        {item.canEdit && item.state !== 'withdrawn' && (
          <button
            className="secondary"
            disabled={mutation.busy}
            onClick={() =>
              void mutation.mutate(
                'content.withdraw',
                { id: item.id, expectedRevision: item.revision },
                'Content withdrawn from future access.',
                refresh,
              )
            }
          >
            Withdraw
          </button>
        )}
        {item.state === 'published' &&
          (['useful', 'needs_update'] as const).map((rating) => (
            <button
              className="secondary"
              key={rating}
              disabled={mutation.busy}
              onClick={() =>
                void mutation.mutate(
                  'content.feedback',
                  { id: item.id, rating },
                  'Resource feedback saved.',
                )
              }
            >
              {rating.replaceAll('_', ' ')}
            </button>
          ))}
      </div>
      {item.canEdit && item.state === 'draft' && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setUploadBusy(true);
            setUploadStatus('');
            try {
              const response = await fetch(url, {
                method: 'POST',
                body: new FormData(e.currentTarget),
              });
              const result = await response.json();
              if (!response.ok || !result.stored)
                throw new Error(result.error?.code || 'UPLOAD_FAILED');
              setUploadStatus(
                'File stored privately. Publish the draft to make it available to its audience.',
              );
              refresh();
            } catch {
              setUploadStatus(
                'Upload failed. Check the file format/size, storage setup and current permissions.',
              );
            } finally {
              setUploadBusy(false);
            }
          }}
        >
          <label htmlFor={`media-${item.id}`}>
            Recording or resource file (MP4, WebM, PDF; up to 20 MB)
          </label>
          <input
            id={`media-${item.id}`}
            name="file"
            type="file"
            accept="video/mp4,video/webm,application/pdf"
            required
          />
          <button disabled={uploadBusy}>
            {uploadBusy ? 'Uploading…' : 'Upload to private storage'}
          </button>
        </form>
      )}
      {uploadStatus && (
        <p className="message" role="status">
          {uploadStatus}
        </p>
      )}
      {mutation.message && (
        <p role="status" className={`message ${mutation.failed ? 'error' : ''}`}>
          {mutation.message}
        </p>
      )}
    </article>
  );
}
