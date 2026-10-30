import { createClient } from '@supabase/supabase-js';
import { authConfig } from '@/server/supabase';
import type { Database } from '@/shared/database.types';
import type { ContentItem } from '@/shared/contracts';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Insights and sessions' };
export default async function Insights() {
  let items: ContentItem[] = [];
  let unavailable = false;
  try {
    const config = authConfig(),
      db = createClient<Database>(config.url, config.key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    const { data, error } = await db
      .rpc('content_public', {})
      .abortSignal(AbortSignal.timeout(5000));
    if (error) throw error;
    items = (data as unknown as { items: ContentItem[] }).items;
  } catch {
    unavailable = true;
  }
  return (
    <>
      <div className="page-intro">
        <span className="eyebrow">Public knowledge · Approved content</span>
        <h1>
          Ideas to explore.
          <br />
          Conversations to continue.
        </h1>
        <p className="lead">
          Published public resources, release notes and session information. Employee and
          client-only content remains in its workspace.
        </p>
      </div>
      {unavailable ? (
        <p className="message">Public content is temporarily unavailable.</p>
      ) : !items.length ? (
        <p className="message">No public insights or sessions have been published yet.</p>
      ) : (
        items.map((item) => (
          <article className="panel" key={item.id}>
            <span className="badge">{item.kind.replaceAll('_', ' ')} · Public</span>
            <h2>{item.title}</h2>
            <p className="prose">{item.body}</p>
            <p className="muted">
              Owner: {item.ownerTeam} · Review date: {item.reviewDate}
            </p>
            {item.startsAt && <p>Session start: {item.startsAt.replace('T', ' ')} UTC</p>}
            {item.hasMedia && (
              <a className="text-link" href={`/api/content/${item.id}/media`}>
                Open approved recording or PDF ↗
              </a>
            )}
          </article>
        ))
      )}
    </>
  );
}
