import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { database, asUser, org, user } from './database';
const publication = '30000000-0000-4000-8000-000000000001';
const key = (input: object = {}) => ({ requestId: randomUUID(), ...input });

test('bookmarks and saved searches are personal, scoped, bounded and withdrawal-aware', async () => {
  const db = await database();
  try {
    const request = key({ id: publication, saved: true });
    await asUser(db, 1, 'bookmarks.set', org(1), request);
    await asUser(db, 1, 'bookmarks.set', org(1), request);
    assert.equal((await asUser(db, 1, 'bookmarks.list', org(1))).items.length, 1);
    assert.equal((await asUser(db, 2, 'bookmarks.list', org(2))).items.length, 0);
    await assert.rejects(() => asUser(db, 1, 'bookmarks.list', org(2)), /WORKSPACE_DENIED/);
    const search = await asUser(
      db,
      1,
      'searches.save',
      org(1),
      key({
        name: 'Seasonality',
        filters: { query: 'seasonal', offeringId: 'financial-analysis-intelligence' },
      }),
    );
    await assert.rejects(
      () => asUser(db, 2, 'searches.delete', org(2), key({ id: search.id })),
      /RESOURCE_DENIED/,
    );
    await assert.rejects(
      () =>
        asUser(
          db,
          1,
          'searches.save',
          org(1),
          key({ name: 'Unsafe', filters: { tenantId: org(2) } }),
        ),
      /INVALID_FILTERS/,
    );
    await assert.rejects(
      () => asUser(db, 1, 'searches.save', org(1), key({ name: 'Unsafe', filters: { query: [] } })),
      /INVALID_FILTERS/,
    );
    await asUser(
      db,
      1,
      'observations.withdraw',
      org(1),
      key({ id: '20000000-0000-4000-8000-000000000001' }),
    );
    assert.equal((await asUser(db, 1, 'bookmarks.list', org(1))).items.length, 0);
    await assert.rejects(
      () => asUser(db, 1, 'comments.list', org(1), { id: publication }),
      /RESOURCE_DENIED/,
    );
    await db.exec(
      `set role authenticated; select set_config('request.jwt.claim.sub','${user(1)}',false);`,
    );
    await assert.rejects(() => db.query('select * from private.bookmarks'), /permission denied/);
  } finally {
    await db.close();
  }
});

test('comments require consent and review, keep private originals private, and inherit parent eligibility', async () => {
  const db = await database();
  try {
    await assert.rejects(
      () =>
        asUser(
          db,
          1,
          'comments.create',
          org(1),
          key({ id: publication, body: 'Private comment draft' }),
        ),
      /RESOURCE_DENIED/,
    );
    const comment = await asUser(
      db,
      1,
      'comments.create',
      org(1),
      key({
        id: publication,
        body: 'Original synthetic confidential detail for review',
        publicationConsent: true,
      }),
    );
    assert.equal(
      (await asUser(db, 2, 'comments.list', org(2), { id: publication })).items.length,
      0,
    );
    assert.equal(
      (await asUser(db, 1, 'comments.list', org(1), { id: publication })).items[0].state,
      'pending',
    );
    await assert.rejects(() => asUser(db, 2, 'comments.queue', org(2)), /FORBIDDEN/);
    await asUser(
      db,
      4,
      'comments.review',
      org(4),
      key({
        id: comment.id,
        decision: 'publish',
        body: 'Reviewed synthetic comparison context.',
        note: 'Identifying details removed.',
      }),
    );
    const shared = (await asUser(db, 2, 'comments.list', org(2), { id: publication })).items[0];
    assert.equal(shared.body, 'Reviewed synthetic comparison context.');
    assert(!JSON.stringify(shared).includes('author_id'));
    assert.equal(shared.decision, null);
    await db.exec(
      `delete from private.role_grants where organisation_id='${org(3)}' and user_id='${user(3)}' and capability='observations.write';`,
    );
    await assert.rejects(
      () =>
        asUser(
          db,
          3,
          'comments.create',
          org(3),
          key({
            id: publication,
            body: 'Read-only viewers cannot submit comments.',
            publicationConsent: true,
          }),
        ),
      /RESOURCE_DENIED/,
    );
    const report = key({
      id: comment.id,
      reason: 'Synthetic confidential detail requires another review.',
    });
    await asUser(db, 2, 'comments.report', org(2), report);
    await asUser(db, 2, 'comments.report', org(2), report);
    assert.equal(
      (await asUser(db, 2, 'comments.list', org(2), { id: publication })).items.length,
      0,
    );
    assert.equal(
      (await asUser(db, 4, 'comments.queue', org(4))).items.find((c: any) => c.id === comment.id)
        .reports.length,
      1,
    );
    await asUser(
      db,
      4,
      'comments.review',
      org(4),
      key({
        id: comment.id,
        decision: 'publish',
        body: 'Reviewed synthetic comparison context.',
        note: 'Concern reviewed and resolved.',
      }),
    );
    await asUser(
      db,
      2,
      'feedback.set',
      org(2),
      key({ id: publication, assessment: 'needs_evidence' }),
    );
    await asUser(
      db,
      4,
      'quality.set',
      org(4),
      key({ id: publication, quality: 'limited', reason: 'Small synthetic sample only.' }),
    );
    assert.equal(
      (await asUser(db, 2, 'quality.get', org(2), { id: publication })).yourFeedback,
      'needs_evidence',
    );
    assert.equal(
      (await asUser(db, 1, 'quality.get', org(1), { id: publication })).yourFeedback,
      null,
    );
    await asUser(db, 1, 'comments.withdraw', org(1), key({ id: comment.id }));
    assert.equal(
      (await asUser(db, 2, 'comments.list', org(2), { id: publication })).items.length,
      0,
    );
    await assert.rejects(
      () =>
        asUser(
          db,
          4,
          'comments.review',
          org(4),
          key({
            id: comment.id,
            decision: 'publish',
            body: 'Cannot restore withdrawn comment.',
            note: 'No restoration.',
          }),
        ),
      /RESOURCE_DENIED/,
    );
  } finally {
    await db.close();
  }
});

test('saved synthetic sandbox runs and feedback enforce user, workspace and entitlement isolation', async () => {
  const db = await database();
  try {
    const payload = key({
      name: 'My seasonal scenario',
      offeringId: 'financial-analysis-intelligence',
    });
    const saved = await asUser(db, 1, 'sandbox.save', org(1), payload);
    assert.equal((await asUser(db, 1, 'sandbox.save', org(1), payload)).id, saved.id);
    assert.equal((await asUser(db, 1, 'sandbox.runs', org(1))).items.length, 1);
    assert.equal((await asUser(db, 2, 'sandbox.runs', org(2))).items.length, 0);
    await assert.rejects(
      () =>
        asUser(
          db,
          2,
          'sandbox.feedback',
          org(2),
          key({ id: saved.id, rating: 'useful', feedback: 'Synthetic feedback' }),
        ),
      /RESOURCE_DENIED/,
    );
    await asUser(
      db,
      1,
      'sandbox.feedback',
      org(1),
      key({ id: saved.id, rating: 'needs_context', feedback: 'Explain the units.' }),
    );
    assert.equal((await asUser(db, 1, 'sandbox.runs', org(1))).items[0].rating, 'needs_context');
    await db.exec(
      `update private.entitlements set enabled=false where organisation_id='${org(1)}';`,
    );
    assert.equal((await asUser(db, 1, 'sandbox.runs', org(1))).items.length, 0);
  } finally {
    await db.close();
  }
});

test('sharing acknowledgement is independent, category is revision-bound, and cohort minimum is configurable', async () => {
  const db = await database();
  try {
    await db.exec(`delete from private.workspace_acknowledgements where user_id='${user(1)}';`);
    assert.equal((await asUser(db, 1, 'dashboard', org(1))).onboarding.acknowledged, false);
    const payload = key({
      title: 'Synthetic operational challenge',
      body: 'Synthetic evidence about seasonal comparison workflows.',
      offeringId: 'financial-analysis-intelligence',
      category: 'operational_challenge',
      topic: 'seasonality',
      industry: 'Financial services',
      region: 'Synthetic region',
      periodStart: '2026-01-01',
      periodEnd: '2026-06-30',
      evidenceType: 'synthetic scenario',
      confidence: 'medium',
      consent: { processing: true, publication: false },
    });
    await assert.rejects(
      () => asUser(db, 1, 'observations.save', org(1), payload),
      /ONBOARDING_REQUIRED/,
    );
    await assert.rejects(
      () => asUser(db, 1, 'onboarding.acknowledge', org(1), key({ understood: true })),
      /INVALID_ACKNOWLEDGEMENT/,
    );
    await asUser(
      db,
      1,
      'onboarding.acknowledge',
      org(1),
      key({ version: 'sharing-v1', understood: true }),
    );
    const saved = await asUser(db, 1, 'observations.save', org(1), payload);
    await asUser(db, 1, 'observations.save', org(1), { ...payload, category: 'product_gap' });
    assert.equal(
      (await asUser(db, 1, 'observations.history', org(1), { id: saved.id })).items[0].category,
      'operational_challenge',
    );
    await assert.rejects(
      () =>
        asUser(db, 1, 'observations.submit', org(1), key({ id: saved.id, expectedRevision: 1 })),
      /PUBLICATION_CONSENT_REQUIRED/,
    );
    await assert.rejects(
      () => asUser(db, 1, 'learning.configure', org(1), key({ minimumOrganisations: 4 })),
      /FORBIDDEN/,
    );
    await db.exec(
      `insert into private.role_grants values('${org(4)}','${user(4)}','portal.admin');`,
    );
    await asUser(db, 4, 'learning.configure', org(4), key({ minimumOrganisations: 4 }));
    const themes = await asUser(db, 1, 'themes.list', org(1));
    assert.equal(themes.minimumOrganisations, 4);
    assert.equal(themes.items.length, 0);
  } finally {
    await db.close();
  }
});
