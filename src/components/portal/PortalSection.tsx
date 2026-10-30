'use client';
import Link from 'next/link';
import { useState } from 'react';
import type { Dashboard, Workspace, ActionInput } from '@/shared/contracts';
import { usePortalMutation, usePortalQuery } from './usePortalQuery';
import { EmptyState, Pager, Publication, QueryState } from './PortalUI';
import { Playground, Assistant } from './Tools';
import { IdeasView } from './IdeasView';
import { MembersView } from './MembersView';
import {
  BookmarkButton,
  BookmarksView,
  PublicationDiscussion,
  SavedSearches,
} from './LearningTools';
import { ContentLibrary } from './ContentLibrary';
import { TeamSpaces } from './TeamSpaces';
import { Administration } from './Administration';

type Props = { workspace: Workspace; dashboard: Dashboard };
export type Section =
  | 'dashboard'
  | 'learning'
  | 'themes'
  | 'ideas'
  | 'notifications'
  | 'playground'
  | 'members'
  | 'bookmarks'
  | 'library'
  | 'teams'
  | 'administration'
  | 'assistant';
const titles: Record<Section, [string, string]> = {
  administration: [
    'Portal administration',
    'Manage explicit organisation access and inspect audited operations without opening private client sources.',
  ],
  teams: [
    'Employee team spaces',
    'Collaborate on synthetic hackathon work with explicitly approved team members.',
  ],
  bookmarks: [
    'Your saved evidence',
    'Personal bookmarks for this workspace. Only currently permitted contributions are shown.',
  ],
  library: [
    'Sessions, resources and experiments',
    'Read published content available to this workspace. Employee submissions and publishing grants are checked separately.',
  ],
  dashboard: [
    'Your perspective. Shared progress.',
    'A clear view of your organisation’s access and the next step you can take.',
  ],
  learning: [
    'Approved shared learning',
    'Reviewed contributions from the learning community. Private drafts and reviewer notes are kept separate.',
  ],
  themes: [
    'Patterns worth exploring',
    'Evidence-linked themes appear only when the configured distinct-organisation minimum is met.',
  ],
  ideas: [
    'From evidence to improvement',
    'Follow the problem, proposed outcome and latest status. An idea is not a delivery commitment.',
  ],
  notifications: [
    'Your updates',
    'Review and contribution updates for you in this workspace. These are in-app notifications.',
  ],
  playground: [
    'Explore a synthetic scenario',
    'A guided seasonal SME cash-flow example. Outputs are simulated and are not business decisions.',
  ],
  members: [
    'People in your organisation',
    'Manage approved client-member access within this workspace. Platform roles remain separately controlled.',
  ],
  assistant: [
    'Ask AIRA',
    'Explore currently permitted approved contributions with visible evidence and limitations.',
  ],
};
export function PortalSection({ section, workspace, dashboard }: Props & { section: Section }) {
  if (section === 'teams' && workspace.kind !== 'employee')
    return (
      <EmptyState title="Employee workspace required">
        Team spaces are restricted to approved employee memberships.
      </EmptyState>
    );
  const needed = (
    {
      learning: 'learning.read',
      administration: 'portal.admin',
      bookmarks: 'learning.read',
      themes: 'learning.read',
      ideas: 'learning.read',
      playground: 'sandbox.run',
      members: 'members.manage',
      assistant: 'learning.read',
    } as Partial<Record<Section, string>>
  )[section];
  if (needed && !dashboard.capabilities.includes(needed))
    return (
      <EmptyState title="This view isn’t available">
        Your current workspace does not grant access. Choose another permitted view from the
        navigation.
      </EmptyState>
    );
  return (
    <>
      <div className="view-heading">
        <div>
          <span className="eyebrow">
            {workspace.name} · {workspace.kind}
          </span>
          <h1>{titles[section][0]}</h1>
          <p>{titles[section][1]}</p>
        </div>
      </div>
      {section === 'dashboard' && <DashboardView workspace={workspace} dashboard={dashboard} />}
      {section === 'learning' && <LearningView workspace={workspace} dashboard={dashboard} />}
      {section === 'bookmarks' && <BookmarksView workspace={workspace} dashboard={dashboard} />}
      {section === 'library' && <ContentLibrary workspace={workspace} dashboard={dashboard} />}
      {section === 'teams' && <TeamSpaces workspaceId={workspace.id} />}
      {section === 'administration' && <Administration workspaceId={workspace.id} />}
      {section === 'themes' && <ThemesView workspace={workspace} dashboard={dashboard} />}
      {section === 'ideas' && <IdeasView workspace={workspace} dashboard={dashboard} />}
      {section === 'notifications' && <Notifications workspace={workspace} />}
      {section === 'playground' && <Playground workspace={workspace} dashboard={dashboard} />}
      {section === 'assistant' && <Assistant workspace={workspace} />}
      {section === 'members' && <MembersView workspace={workspace} />}
    </>
  );
}
function DashboardView({ workspace, dashboard }: Props) {
  const base = `/workspace/${workspace.id}`,
    cap = (c: string) => dashboard.capabilities.includes(c);
  return (
    <>
      <div className="stat-grid">
        <div className="stat">
          <strong>{dashboard.contributionCount}</strong>
          <span>Your observations</span>
        </div>
        <div className="stat">
          <strong>{dashboard.offerings.length}</strong>
          <span>Entitled offerings</span>
        </div>
        <div className="stat">
          <strong>{workspace.kind === 'employee' ? 'Internal' : 'Client'}</strong>
          <span>Active workspace</span>
        </div>
      </div>
      <section className="panel">
        <span className="eyebrow">Your next contribution</span>
        <h2>
          {workspace.kind === 'employee'
            ? 'Connect insight to improvement.'
            : 'What are you seeing in the market?'}
        </h2>
        <p className="muted">
          Record synthetic observations privately. Choose organisation visibility separately, and
          submit for moderator review only when you want to propose community publication.
        </p>
        {cap('observations.write') && (
          <Link className="button" href={base}>
            Record an observation →
          </Link>
        )}
      </section>
      <div className="dashboard-links">
        {cap('learning.read') && (
          <>
            <Link href={`${base}/learning`}>
              <h3>Explore shared learning ↗</h3>
              <p>Read approved evidence, filter observations and report a concern.</p>
            </Link>
            <Link href={`${base}/ideas`}>
              <h3>Follow improvement ideas ↗</h3>
              <p>Understand the proposed outcome and the current status.</p>
            </Link>
          </>
        )}
        {cap('learning.moderate') && (
          <Link href={`${base}/moderation`}>
            <h3>Review contributions ↗</h3>
            <p>Clarify, redact and publish permitted submitted revisions.</p>
          </Link>
        )}
        {cap('sandbox.run') && (
          <Link href={`${base}/playground`}>
            <h3>Open the Playground ↗</h3>
            <p>Inspect a deterministic synthetic seasonality example.</p>
          </Link>
        )}
      </div>
      <h2>Available to your organisation</h2>
      {dashboard.offerings.length ? (
        dashboard.offerings.map((o) => (
          <article className="publication-card" key={o.id}>
            <h3>{o.title}</h3>
            <span className="badge">Entitled offering</span>
          </article>
        ))
      ) : (
        <EmptyState title="No offerings assigned">
          Ask your organisation’s administrator to arrange access. Another organisation’s content is
          never shown here as a substitute.
        </EmptyState>
      )}
      <h2>Sessions and resources</h2>
      {[...dashboard.sessions, ...dashboard.resources, ...dashboard.experiments].length ? (
        [...dashboard.sessions, ...dashboard.resources, ...dashboard.experiments].map((item) => (
          <article className="publication-card" key={item.id}>
            <span className="badge">{item.kind.replaceAll('_', ' ')}</span>
            <h3>{item.title}</h3>
            <p className="muted">
              {item.ownerTeam} · Review {item.reviewDate}
            </p>
            <Link className="text-link" href={`${base}/library`}>
              Open in your library →
            </Link>
          </article>
        ))
      ) : (
        <EmptyState title="No published resources assigned">
          Sessions, resources and employee experiments appear here only when published for your
          current workspace and entitlements.
        </EmptyState>
      )}
      <p className="subtle-note">
        Workspace membership is separate from permission to publish, disclose attribution or
        participate in future model training.
      </p>
    </>
  );
}
function LearningView({ workspace, dashboard }: Props) {
  const [page, setPage] = useState(0),
    [filters, setFilters] = useState<Omit<ActionInput<'learning.list'>, 'page' | 'pageSize'>>({});
  const [filterError, setFilterError] = useState('');
  const query = usePortalQuery('learning.list', workspace.id, { ...filters, page, pageSize: 20 });
  const mutation = usePortalMutation(workspace.id);
  const bookmarks = usePortalQuery('bookmarks.list', workspace.id, {});
  return (
    <>
      <SavedSearches
        workspaceId={workspace.id}
        filters={filters}
        apply={(saved) => {
          setFilters(saved);
          setPage(0);
          setFilterError('');
        }}
      />
      <form
        key={JSON.stringify(filters)}
        className="filter-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const next: Record<string, string> = {};
          for (const key of [
            'query',
            'offeringId',
            'topic',
            'industry',
            'region',
            'periodStart',
            'periodEnd',
          ]) {
            const value = String(f.get(key) || '').trim();
            if (value) next[key] = value;
          }
          if (next.periodStart && next.periodEnd && next.periodEnd < next.periodStart) {
            setFilterError('The observation end date must be on or after the start date.');
            return;
          }
          setFilterError('');
          setFilters(next);
          setPage(0);
        }}
      >
        <div className="grid">
          <div>
            <label htmlFor="search">Search approved evidence</label>
            <input
              id="search"
              name="query"
              maxLength={200}
              placeholder="Try seasonality…"
              defaultValue={filters.query}
            />
          </div>
          <div>
            <label htmlFor="learning-offering">Offering</label>
            <select
              id="learning-offering"
              name="offeringId"
              defaultValue={filters.offeringId || ''}
            >
              <option value="">All entitled offerings</option>
              {dashboard.offerings.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        <details>
          <summary>More filters</summary>
          <div className="grid">
            {['topic', 'industry', 'region'].map((key) => (
              <div key={key}>
                <label htmlFor={`filter-${key}`}>{key[0].toUpperCase() + key.slice(1)}</label>
                <input
                  id={`filter-${key}`}
                  name={key}
                  maxLength={80}
                  defaultValue={filters[key as 'topic' | 'industry' | 'region']}
                />
              </div>
            ))}
            <div>
              <label htmlFor="period-start">Observed from</label>
              <input
                id="period-start"
                name="periodStart"
                type="date"
                defaultValue={filters.periodStart}
              />
            </div>
            <div>
              <label htmlFor="period-end">Observed until</label>
              <input
                id="period-end"
                name="periodEnd"
                type="date"
                defaultValue={filters.periodEnd}
              />
            </div>
          </div>
        </details>
        <div className="row">
          <button>Apply filters →</button>
          <button
            type="reset"
            className="secondary"
            onClick={() => {
              setFilters({});
              setPage(0);
              setFilterError('');
            }}
          >
            Clear filters
          </button>
          <button type="button" className="secondary" onClick={query.refresh}>
            Refresh
          </button>
        </div>
      </form>
      {filterError && (
        <p className="message error" role="alert">
          {filterError}
        </p>
      )}
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
            <EmptyState title="No approved contributions found">
              Try other filters or check back after contributions have been reviewed. Private
              observations do not appear here.
            </EmptyState>
          )}
          {query.data.items.map((item) => (
            <Publication key={item.id} item={item}>
              <BookmarkButton
                workspaceId={workspace.id}
                id={item.id}
                saved={!!bookmarks.data?.items.some((b) => b.id === item.id)}
                refresh={bookmarks.refresh}
              />
              <PublicationDiscussion workspace={workspace} dashboard={dashboard} id={item.id} />
              {dashboard.capabilities.includes('learning.report') && (
                <details>
                  <summary>Report a concern</summary>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const reason = String(new FormData(e.currentTarget).get('reason'));
                      void mutation.mutate(
                        'reports.create',
                        { id: item.id, reason },
                        'Your report was recorded for moderator review.',
                        query.refresh,
                      );
                    }}
                  >
                    <label htmlFor={`report-${item.id}`}>What should the moderator review?</label>
                    <textarea
                      id={`report-${item.id}`}
                      name="reason"
                      minLength={5}
                      maxLength={2000}
                      required
                    />
                    <p className="subtle-note">
                      Describe the concern without identifying another client or adding confidential
                      information.
                    </p>
                    <button disabled={mutation.busy}>Submit report</button>
                  </form>
                </details>
              )}
            </Publication>
          ))}
          <Pager page={page} setPage={setPage} count={query.data.items.length} busy={false} />
        </>
      )}
    </>
  );
}
function ThemesView({ workspace, dashboard }: Props) {
  const [page, setPage] = useState(0),
    [offering, setOffering] = useState('');
  const query = usePortalQuery('themes.list', workspace.id, {
    page,
    pageSize: 20,
    ...(offering ? { offeringId: offering } : {}),
  });
  const configuration = usePortalMutation(workspace.id);
  return (
    <>
      {dashboard.capabilities.includes('portal.admin') && (
        <details className="panel">
          <summary>Configure the shared-theme cohort minimum</summary>
          <p className="subtle-note">
            Platform-wide control. Suppression still applies to every read. A cohort minimum is not
            an anonymity guarantee.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void configuration.mutate(
                'learning.configure',
                { minimumOrganisations: Number(new FormData(e.currentTarget).get('minimum')) },
                'Shared-theme cohort minimum updated.',
                query.refresh,
              );
            }}
          >
            <label htmlFor="cohort-minimum">Distinct organisations (3–100)</label>
            <input
              id="cohort-minimum"
              name="minimum"
              type="number"
              min={3}
              max={100}
              required
              defaultValue={query.data?.minimumOrganisations || 3}
            />
            <button disabled={configuration.busy}>Update minimum</button>
          </form>
          {configuration.message && (
            <p role="status" className={`message ${configuration.failed ? 'error' : ''}`}>
              {configuration.message}
            </p>
          )}
        </details>
      )}
      <div className="filter-form">
        <label htmlFor="theme-offering">Offering</label>
        <select
          id="theme-offering"
          value={offering}
          onChange={(e) => {
            setOffering(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All entitled offerings</option>
          {dashboard.offerings.map((o) => (
            <option value={o.id} key={o.id}>
              {o.title}
            </option>
          ))}
        </select>
      </div>
      {!query.data ? (
        <QueryState error={query.error} retry={query.refresh} />
      ) : (
        <>
          {query.data.items.map((theme) => (
            <article className="panel" key={theme.id}>
              <span className="badge">{theme.organisations} contributing organisations</span>
              <h2>{theme.title}</h2>
              <p className="muted">
                {theme.periodStart} – {theme.periodEnd}
              </p>
              <p className="message">{theme.limitations}</p>
              <p className="subtle-note">Last publication: {theme.updatedAt.slice(0, 10)}</p>
              <details>
                <summary>Inspect {theme.evidence.length} approved supporting contributions</summary>
                {theme.evidence.map((item) => (
                  <Publication item={item} key={item.id} />
                ))}
              </details>
            </article>
          ))}
          {!query.data.items.length && (
            <EmptyState title="No eligible themes to show">
              There may be no matching evidence, or the minimum cohort has not been met. Suppressed
              organisation counts are not disclosed.
            </EmptyState>
          )}
          <Pager page={page} setPage={setPage} count={query.data.items.length} busy={false} />
        </>
      )}
      {query.data && (
        <p className="subtle-note">
          Configured minimum: {query.data.minimumOrganisations} distinct contributing organisations.
        </p>
      )}
      <p className="subtle-note">
        Small synthetic cohorts do not establish market prevalence or guarantee anonymity. Only
        offering-level theme filtering is supported.
      </p>
    </>
  );
}
function Notifications({ workspace }: { workspace: Workspace }) {
  const [page, setPage] = useState(0),
    query = usePortalQuery('notifications.list', workspace.id, { page, pageSize: 20 }),
    mutation = usePortalMutation(workspace.id);
  return (
    <>
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
            <EmptyState title="You’re all caught up">
              Review and contribution updates will appear here.
            </EmptyState>
          )}
          {query.data.items.map((n) => (
            <article className={`notification ${n.read_at ? '' : 'is-unread'}`} key={n.id}>
              <div>
                <p>{n.message}</p>
                <time dateTime={n.created_at}>{n.created_at.slice(0, 10)}</time>
                <span className="subtle-note"> · {n.read_at ? 'Read' : 'Unread'}</span>
              </div>
              {!n.read_at && (
                <button
                  className="secondary"
                  disabled={mutation.busy}
                  onClick={() =>
                    void mutation.mutate(
                      'notifications.read',
                      { id: n.id },
                      'Marked as read.',
                      query.refresh,
                    )
                  }
                >
                  Mark read
                </button>
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
