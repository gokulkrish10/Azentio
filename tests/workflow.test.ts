import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { database, asUser, org, user } from './database';
const input = (extra: object = {}) => ({
  requestId: randomUUID(),
  title: 'Synthetic seasonal observation',
  body: 'SYNTHETIC private source: customer identifier should never appear in reviewed shared fields.',
  offeringId: 'financial-analysis-intelligence',
  topic: 'seasonality',
  industry: 'Financial services',
  region: 'Broad synthetic region',
  periodStart: '2026-01-01',
  periodEnd: '2026-06-30',
  evidenceType: 'synthetic scenario',
  confidence: 'medium',
  audience: 'private',
  consent: { processing: true, publication: true, attribution: false, training: false },
  ...extra,
});
const key = (extra: object = {}) => ({ requestId: randomUUID(), ...extra });
const pub = (id: string, v = 1) =>
  key({
    id,
    expectedRevision: v,
    decision: 'publish',
    note: 'Reviewed and de-identified synthetic evidence.',
    title: 'Reviewed seasonal context',
    body: 'SYNTHETIC approved copy: equivalent-period comparisons need seasonal context; this is limited illustrative evidence.',
    topic: 'seasonality',
    industry: 'Financial services',
    region: 'Broad synthetic region',
    periodStart: '2026-01-01',
    periodEnd: '2026-06-30',
  });

test('draft → locked submission → clarification → revision-specific reviewed publication', async () => {
  const db = await database();
  try {
    const saved = await asUser(db, 1, 'observations.save', org(1), input());
    let queue = await asUser(db, 4, 'moderation.list', org(4));
    assert(!queue.items.some((x: any) => x.id === saved.id));
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${user(4)}',false);`,
    );
    assert.equal(
      (await db.query('select * from private.observations')).rows.length,
      0,
      'moderator cannot query arbitrary drafts',
    );
    await assert.rejects(
      () =>
        db.query(
          `insert into private.role_grants values('${org(1)}','${user(1)}','learning.moderate')`,
        ),
      /permission denied/,
    );
    await assert.rejects(() => db.query('select * from private.publications'), /permission denied/);
    await db.exec('reset role');
    await assert.rejects(
      () =>
        asUser(db, 2, 'observations.submit', org(2), key({ id: saved.id, expectedRevision: 1 })),
      /RESOURCE_DENIED/,
    );
    await asUser(db, 1, 'observations.submit', org(1), key({ id: saved.id, expectedRevision: 1 }));
    await assert.rejects(
      () =>
        asUser(db, 1, 'observations.save', org(1), input({ id: saved.id, expectedRevision: 1 })),
      /INVALID_TRANSITION/,
    );
    await assert.rejects(
      () => asUser(db, 4, 'moderation.decide', org(4), pub(saved.id, 2)),
      /REVIEW_DENIED/,
    );
    await asUser(
      db,
      4,
      'moderation.decide',
      org(4),
      key({
        id: saved.id,
        expectedRevision: 1,
        decision: 'clarify',
        note: 'Clarify synthetic period.',
      }),
    );
    const amended = await asUser(
      db,
      1,
      'observations.save',
      org(1),
      input({ id: saved.id, expectedRevision: 1 }),
    );
    assert.equal(amended.revision, 2);
    await assert.rejects(
      () =>
        asUser(db, 1, 'observations.save', org(1), input({ id: saved.id, expectedRevision: 1 })),
      /REVISION_CONFLICT/,
    );
    await asUser(db, 1, 'observations.submit', org(1), key({ id: saved.id, expectedRevision: 2 }));
    await assert.rejects(
      () =>
        asUser(db, 4, 'moderation.decide', org(4), {
          ...pub(saved.id, 2),
          attribution: 'Synthetic Cedar',
        }),
      /ATTRIBUTION_DENIED/,
    );
    const decision = pub(saved.id, 2);
    const a = await asUser(db, 4, 'moderation.decide', org(4), decision);
    const b = await asUser(db, 4, 'moderation.decide', org(4), decision);
    assert.deepEqual(a, b);
    const shared = await asUser(db, 2, 'learning.list', org(2));
    const p = shared.items.find((x: any) => x.id === a.publicationId);
    assert(p);
    assert(!JSON.stringify(p).includes('customer identifier'));
    assert.deepEqual(
      Object.keys(p).sort(),
      [
        'id',
        'title',
        'body',
        'offeringId',
        'topic',
        'industry',
        'region',
        'periodStart',
        'periodEnd',
        'evidenceType',
        'confidence',
        'attribution',
        'publishedAt',
      ].sort(),
    );
    const copies = await db.query<{ n: number }>(
      'select count(*)::integer n from private.publications where observation_id=$1 and available',
      [saved.id],
    );
    assert.equal(copies.rows[0].n, 1);
    const notes = await asUser(db, 1, 'notifications.list', org(1));
    assert(notes.items.length >= 2);
    assert(!JSON.stringify(notes).includes('customer identifier'));
    await asUser(db, 1, 'observations.save', org(1), input({ id: saved.id, expectedRevision: 2 }));
    assert(
      !(await asUser(db, 2, 'learning.list', org(2))).items.some(
        (x: any) => x.id === a.publicationId,
      ),
      'material edit removes previous shared copy',
    );
  } finally {
    await db.close();
  }
});

test('withdrawal synchronously removes feed, AI retrieval, themes and idea evidence', async () => {
  const db = await database();
  try {
    assert.equal((await asUser(db, 2, 'themes.list', org(2))).items[0].organisations, 3);
    const before = await asUser(db, 2, 'ideas.list', org(2));
    assert.equal(before.items[0].evidence.length, 3);
    const started = Date.now();
    await asUser(
      db,
      1,
      'observations.withdraw',
      org(1),
      key({ id: '20000000-0000-4000-8000-000000000001' }),
    );
    assert(
      !(await asUser(db, 2, 'learning.list', org(2))).items.some(
        (p: any) => p.id === '30000000-0000-4000-8000-000000000001',
      ),
    );
    assert.equal(
      (
        await asUser(db, 2, 'learning.recheck', org(2), {
          ids: ['30000000-0000-4000-8000-000000000001'],
        })
      ).items.length,
      0,
    );
    assert.equal((await asUser(db, 2, 'themes.list', org(2))).items.length, 0);
    assert.equal((await asUser(db, 2, 'ideas.list', org(2))).items[0].evidence.length, 2);
    assert(Date.now() - started < 60000);
    assert.equal(
      (await db.query('select * from private.consents')).rows.length,
      5,
      'consent history remains',
    );
  } finally {
    await db.close();
  }
});

test('duplicate organisations, filters, entitlement and RLS do not broaden evidence access', async () => {
  const db = await database();
  try {
    await asUser(
      db,
      3,
      'observations.withdraw',
      org(3),
      key({ id: '20000000-0000-4000-8000-000000000003' }),
    );
    const saved = await asUser(db, 1, 'observations.save', org(1), input());
    await asUser(db, 1, 'observations.submit', org(1), key({ id: saved.id, expectedRevision: 1 }));
    await asUser(db, 4, 'moderation.decide', org(4), pub(saved.id));
    assert.equal(
      (await asUser(db, 2, 'themes.list', org(2))).items.length,
      0,
      'three posts from two organisations are suppressed',
    );
    const employeeDraft = await asUser(db, 4, 'observations.save', org(4), input());
    await asUser(
      db,
      4,
      'observations.submit',
      org(4),
      key({ id: employeeDraft.id, expectedRevision: 1 }),
    );
    await asUser(db, 4, 'moderation.decide', org(4), pub(employeeDraft.id));
    assert.equal(
      (await asUser(db, 2, 'themes.list', org(2))).items.length,
      0,
      'an employee organisation cannot substitute for a third synthetic client',
    );
    await assert.rejects(
      () => asUser(db, 2, 'themes.list', org(2), { region: 'Broad synthetic region' }),
      /UNSAFE_BREAKDOWN/,
    );
    assert.equal(
      (await asUser(db, 2, 'learning.list', org(2), { query: 'nonexistentquery' })).items.length,
      0,
    );
    await db.exec(
      `update private.entitlements set enabled=false where organisation_id='${org(2)}';`,
    );
    assert.equal((await asUser(db, 2, 'learning.list', org(2))).items.length, 0);
    assert.equal((await asUser(db, 2, 'dashboard', org(2))).contributionCount, 0);
    assert.equal((await asUser(db, 2, 'themes.list', org(2))).items.length, 0);
    assert.equal((await asUser(db, 2, 'ideas.list', org(2))).items.length, 0);
    await assert.rejects(
      () => asUser(db, 2, 'sandbox.run', org(2), { offeringId: 'financial-analysis-intelligence' }),
      /FORBIDDEN/,
    );
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${user(2)}',false);`,
    );
    assert.equal((await db.query('select * from private.observations')).rows.length, 0);
    assert.equal((await db.query('select * from private.revisions')).rows.length, 0);
    await assert.rejects(
      () => db.query(`update private.entitlements set enabled=true`),
      /permission denied/,
    );
    await db.exec('reset role');
  } finally {
    await db.close();
  }
});

test('consent is independent; saves never publish; actor and audience checks fail closed', async () => {
  const db = await database();
  try {
    const draft = await asUser(
      db,
      1,
      'observations.save',
      org(1),
      input({ consent: { processing: true, publication: false } }),
    );
    await assert.rejects(
      () =>
        asUser(db, 1, 'observations.submit', org(1), key({ id: draft.id, expectedRevision: 1 })),
      /PUBLICATION_CONSENT_REQUIRED/,
    );
    await assert.rejects(
      () => asUser(db, 1, 'observations.save', org(1), input({ consent: { processing: false } })),
      /PROCESSING_CONSENT_REQUIRED/,
    );
    await assert.rejects(
      () => asUser(db, 1, 'observations.save', org(1), input({ audience: 'public' })),
      /check constraint/,
    );
    const c = await db.query<{ training: boolean }>(
      'select training from private.consents where observation_id=$1',
      [draft.id],
    );
    assert.equal(c.rows[0].training, false);
    await db.exec(
      `insert into private.memberships values('${org(4)}','${user(6)}','employee',true,null,true); insert into private.role_grants values('${org(4)}','${user(6)}','learning.moderate');`,
    );
    await assert.rejects(
      () => asUser(db, 6, 'moderation.list', org(4)),
      /WORKSPACE_DENIED/,
      'suffix alone or non-work account cannot become employee',
    );
    await db.exec(
      `insert into private.role_grants values('${org(1)}','${user(1)}','learning.moderate'),('${org(1)}','${user(1)}','portal.admin');`,
    );
    await assert.rejects(() => asUser(db, 1, 'moderation.list', org(1)), /FORBIDDEN/);
  } finally {
    await db.close();
  }
});

test('invitations bind verified account, tenant, expiry, single use; no client escalation', async () => {
  const db = await database();
  try {
    const invitation = await asUser(
      db,
      1,
      'invitations.create',
      org(1),
      key({ intendedUserId: user(7), role: 'client_member' }),
    );
    await assert.rejects(
      () => asUser(db, 8, 'invitations.accept', org(1), { id: invitation.id }),
      /INVITATION_DENIED/,
    );
    await assert.rejects(
      () => asUser(db, 7, 'invitations.accept', org(2), { id: invitation.id }),
      /INVITATION_DENIED/,
    );
    await asUser(db, 7, 'invitations.accept', org(1), { id: invitation.id });
    await assert.rejects(
      () => asUser(db, 7, 'invitations.accept', org(1), { id: invitation.id }),
      /INVITATION_DENIED/,
    );
    await assert.rejects(
      () =>
        asUser(
          db,
          1,
          'invitations.create',
          org(1),
          key({ intendedUserId: user(8), role: 'employee' }),
        ),
      /ROLE_DENIED/,
    );
    const expired = await asUser(
      db,
      1,
      'invitations.create',
      org(1),
      key({ intendedUserId: user(8), role: 'client_member' }),
    );
    await db.query(
      "update private.invitations set expires_at=now()-interval '1 minute' where id=$1",
      [expired.id],
    );
    await assert.rejects(
      () => asUser(db, 8, 'invitations.accept', org(1), { id: expired.id }),
      /INVITATION_DENIED/,
    );
    await asUser(db, 1, 'members.revoke', org(1), key({ id: user(7) }));
    await assert.rejects(() => asUser(db, 7, 'dashboard', org(1)), /WORKSPACE_DENIED/);
  } finally {
    await db.close();
  }
});

test('reports suspend and resolve; withdrawal cannot be restored', async () => {
  const db = await database();
  try {
    const publicationId = '30000000-0000-4000-8000-000000000001',
      observationId = '20000000-0000-4000-8000-000000000001';
    await asUser(
      db,
      2,
      'reports.create',
      org(2),
      key({ id: publicationId, reason: 'Synthetic evidence needs review.' }),
    );
    const report = (await db.query<{ id: string }>('select id from private.reports')).rows[0];
    await asUser(
      db,
      4,
      'moderation.decide',
      org(4),
      key({
        id: observationId,
        expectedRevision: 1,
        decision: 'suspend',
        note: 'Investigating report.',
      }),
    );
    assert(
      !(await asUser(db, 2, 'learning.list', org(2))).items.some(
        (p: any) => p.id === publicationId,
      ),
    );
    await asUser(
      db,
      4,
      'reports.resolve',
      org(4),
      key({ id: report.id, note: 'Reviewed as safe synthetic evidence.', restore: true }),
    );
    assert(
      (await asUser(db, 2, 'learning.list', org(2))).items.some((p: any) => p.id === publicationId),
    );
    await asUser(db, 1, 'observations.withdraw', org(1), key({ id: observationId }));
    await assert.rejects(
      () =>
        asUser(
          db,
          4,
          'reports.resolve',
          org(4),
          key({ id: report.id, note: 'Must not restore withdrawn material.', restore: true }),
        ),
      /RESTORE_DENIED/,
    );
  } finally {
    await db.close();
  }
});

test('assigned idea owner needs independent evidence permission; status changes are audited', async () => {
  const db = await database();
  try {
    const i = await asUser(
      db,
      4,
      'ideas.create',
      org(4),
      key({
        title: 'Synthetic explanation improvement',
        problem: 'Seasonal explanations need more transparent supporting evidence.',
        offeringId: 'financial-analysis-intelligence',
        outcome: 'Explain seasonal context and its limitations.',
        team: 'Synthetic team',
        priority: 'medium',
        evidence: ['30000000-0000-4000-8000-000000000001'],
      }),
    );
    await asUser(db, 4, 'ideas.update', org(4), key({ id: i.id, status: 'Under review' }));
    await assert.rejects(
      () => asUser(db, 1, 'ideas.update', org(1), key({ id: i.id, status: 'Released' })),
      /FORBIDDEN/,
    );
    await db.exec(
      `delete from private.role_grants where user_id='${user(4)}' and capability='learning.read';`,
    );
    await assert.rejects(
      () => asUser(db, 4, 'ideas.update', org(4), key({ id: i.id, status: 'Released' })),
      /EVIDENCE_DENIED/,
    );
    await assert.rejects(
      () =>
        asUser(
          db,
          4,
          'ideas.create',
          org(4),
          key({
            title: 'Blocked evidence use',
            problem: 'Assignment is not evidence permission; this should fail.',
            offeringId: 'financial-analysis-intelligence',
            outcome: 'Never leak private material.',
            team: 'Synthetic',
            priority: 'low',
            evidence: ['30000000-0000-4000-8000-000000000001'],
          }),
        ),
      /EVIDENCE_DENIED/,
    );
    assert.equal(
      (await db.query("select * from private.audit_events where action='ideas.update'")).rows
        .length,
      1,
    );
  } finally {
    await db.close();
  }
});

test('concurrent duplicate mutation produces one draft and one audit; seed re-run is idempotent', async () => {
  const db = await database();
  try {
    const payload = input();
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${user(1)}',false);`,
    );
    const rows = await Promise.all(
      Array.from({ length: 6 }, () =>
        db.query<{ v: any }>('select public.portal($1,$2,$3) v', [
          'observations.save',
          org(1),
          payload,
        ]),
      ),
    );
    assert.equal(new Set(rows.map((r) => r.rows[0].v.id)).size, 1);
    await db.exec('reset role');
    assert.equal(
      (await db.query("select * from private.audit_events where action='observations.save'")).rows
        .length,
      1,
    );
    const n = (await db.query('select * from private.publications')).rows.length;
    await db.exec(await readFile('supabase/seed.sql', 'utf8'));
    assert.equal((await db.query('select * from private.publications')).rows.length, n);
  } finally {
    await db.close();
  }
});

test('organisation sharing never broadens old private revisions; authors can inspect consent history', async () => {
  const db = await database();
  try {
    const a = await asUser(db, 1, 'observations.save', org(1), input());
    await asUser(
      db,
      1,
      'observations.save',
      org(1),
      input({ id: a.id, expectedRevision: 1, audience: 'organisation' }),
    );
    await db.exec(
      `insert into private.memberships values('${org(1)}','${user(7)}','client_member',true,null,false);`,
    );
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${user(7)}',false);`,
    );
    const r = await db.query<{ version: number }>(
      'select version from private.revisions where observation_id=$1',
      [a.id],
    );
    assert.deepEqual(
      r.rows.map((x) => x.version),
      [2],
    );
    await db.exec('reset role');
    const h = await asUser(db, 1, 'observations.history', org(1), { id: a.id });
    assert.equal(h.items.length, 2);
    assert.equal(h.items[0].consent.training, false);
    assert.equal(h.items[1].source_audience, 'private');
    await assert.rejects(
      () => asUser(db, 7, 'observations.history', org(1), { id: a.id }),
      /RESOURCE_DENIED/,
    );
  } finally {
    await db.close();
  }
});

test('moderator withdrawal removes publication; portal admin does not imply private review access', async () => {
  const db = await database();
  try {
    await db.exec(
      `insert into private.memberships values('${org(4)}','${user(5)}','employee',true,null,true);insert into private.role_grants values('${org(4)}','${user(5)}','portal.admin');`,
    );
    await assert.rejects(() => asUser(db, 5, 'moderation.list', org(4)), /FORBIDDEN/);
    await asUser(
      db,
      4,
      'moderation.decide',
      org(4),
      key({
        id: '20000000-0000-4000-8000-000000000001',
        expectedRevision: 1,
        decision: 'withdraw',
        note: 'Synthetic contribution permanently withdrawn after review.',
      }),
    );
    assert.equal((await asUser(db, 2, 'themes.list', org(2))).items.length, 0);
    assert(
      !(await asUser(db, 2, 'learning.list', org(2))).items.some(
        (p: any) => p.id === '30000000-0000-4000-8000-000000000001',
      ),
    );
  } finally {
    await db.close();
  }
});
