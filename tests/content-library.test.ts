import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { database, asUser, org, user } from './database';
const key = (extra: object = {}) => ({ requestId: randomUUID(), ...extra });
const draft = (extra: object = {}) =>
  key({
    kind: 'resource',
    title: 'Synthetic reviewed resource',
    body: 'Synthetic internal knowledge about seasonal comparisons.',
    audience: 'employee',
    ownerTeam: 'Synthetic learning team',
    reviewDate: '2026-12-01',
    offeringId: 'financial-analysis-intelligence',
    ...extra,
  });
test('content requires separate publishers and explicit cross-tenant assignments; private media gates follow withdrawal', async () => {
  const db = await database();
  try {
    await assert.rejects(
      () => asUser(db, 4, 'content.save', org(4), draft()),
      /PUBLISHER_REQUIRED/,
    );
    await db.exec(
      `insert into private.role_grants values('${org(4)}','${user(4)}','content.publish');`,
    );
    await assert.rejects(
      () =>
        asUser(
          db,
          4,
          'content.save',
          org(4),
          draft({ audience: 'organisation', targetWorkspace: org(1) }),
        ),
      /PUBLISHER_ASSIGNMENT_REQUIRED/,
    );
    const resource = await asUser(db, 4, 'content.save', org(4), draft());
    assert(
      !(await asUser(db, 1, 'content.list', org(1))).items.some((x: any) => x.id === resource.id),
    );
    const path = `${resource.id}/${randomUUID()}`;
    await asUser(
      db,
      4,
      'content.attach',
      org(4),
      key({ id: resource.id, expectedRevision: 1, path, type: 'application/pdf' }),
    );
    await asUser(db, 4, 'content.publish', org(4), key({ id: resource.id, expectedRevision: 1 }));
    assert(
      (await asUser(db, 4, 'dashboard', org(4))).resources.some((x: any) => x.id === resource.id),
    );
    await assert.rejects(
      () => asUser(db, 1, 'content.asset', org(1), { id: resource.id }),
      /RESOURCE_DENIED/,
    );
    await db.exec(`set role anon; select set_config('request.jwt.claim.sub','',false);`);
    assert.equal(
      (await db.query<{ r: any }>('select public.content_public() r')).rows[0].r.items.length,
      0,
    );
    assert.equal(
      (await db.query<{ r: boolean }>('select private.storage_content_read($1) r', [path])).rows[0]
        .r,
      false,
    );
    await db.exec('reset role');
    await asUser(db, 4, 'content.withdraw', org(4), key({ id: resource.id, expectedRevision: 1 }));
    await assert.rejects(
      () => asUser(db, 4, 'content.asset', org(4), { id: resource.id }),
      /RESOURCE_DENIED/,
    );
  } finally {
    await db.close();
  }
});
test('employee experiments stay private until submission, require publisher review, and never reach clients/public', async () => {
  const db = await database();
  try {
    await db.exec(
      `insert into private.memberships values('${org(4)}','${user(5)}','employee',true,null,true); insert into private.role_grants values('${org(4)}','${user(5)}','observations.write');`,
    );
    await assert.rejects(
      () => asUser(db, 1, 'content.save', org(1), draft({ kind: 'experiment' })),
      /EMPLOYEE_REQUIRED/,
    );
    const experiment = await asUser(
      db,
      5,
      'content.save',
      org(4),
      draft({ kind: 'experiment', offeringId: undefined }),
    );
    await db.exec(
      `insert into private.role_grants values('${org(4)}','${user(4)}','content.publish');`,
    );
    assert(
      !(await asUser(db, 4, 'content.list', org(4))).items.some((x: any) => x.id === experiment.id),
    );
    await asUser(db, 5, 'content.submit', org(4), key({ id: experiment.id, expectedRevision: 1 }));
    assert(
      (await asUser(db, 4, 'content.list', org(4))).items.some((x: any) => x.id === experiment.id),
    );
    await assert.rejects(
      () =>
        asUser(db, 5, 'content.publish', org(4), key({ id: experiment.id, expectedRevision: 1 })),
      /PUBLISHER_REQUIRED/,
    );
    await asUser(db, 4, 'content.publish', org(4), key({ id: experiment.id, expectedRevision: 1 }));
    assert.equal(
      (await asUser(db, 1, 'content.list', org(1), { kind: 'experiment' })).items.length,
      0,
    );
    const edit = await asUser(
      db,
      5,
      'content.save',
      org(4),
      draft({
        id: experiment.id,
        expectedRevision: 1,
        kind: 'experiment',
        offeringId: undefined,
        title: 'Amended synthetic employee experiment',
      }),
    );
    assert.equal(edit.revision, 2);
    assert.equal((await asUser(db, 4, 'dashboard', org(4))).experiments.length, 0);
  } finally {
    await db.close();
  }
});
test('explicit public publication is independent from broadcasts and cross-client resources retain their target', async () => {
  const db = await database();
  try {
    await db.exec(
      `insert into private.role_grants values('${org(4)}','${user(4)}','content.publish');insert into private.publisher_assignments values('${user(4)}','${org(4)}','${org(1)}');`,
    );
    await assert.rejects(
      () => asUser(db, 4, 'content.save', org(4), draft({ kind: 'session' })),
      /PUBLISHER_REQUIRED/,
    );
    const targeted = await asUser(
      db,
      4,
      'content.save',
      org(4),
      draft({ audience: 'organisation', targetWorkspace: org(1) }),
    );
    await asUser(db, 4, 'content.publish', org(4), key({ id: targeted.id, expectedRevision: 1 }));
    assert(
      (await asUser(db, 1, 'content.list', org(1))).items.some((x: any) => x.id === targeted.id),
    );
    assert.equal((await asUser(db, 2, 'content.list', org(2))).items.length, 0);
    const pending = await asUser(
      db,
      4,
      'content.save',
      org(4),
      draft({ audience: 'organisation', targetWorkspace: org(1) }),
    );
    await db.exec(`delete from private.publisher_assignments where user_id='${user(4)}';`);
    await assert.rejects(
      () => asUser(db, 4, 'content.publish', org(4), key({ id: pending.id, expectedRevision: 1 })),
      /RESOURCE_DENIED/,
    );
    const publicItem = await asUser(db, 4, 'content.save', org(4), draft({ audience: 'public' }));
    await asUser(db, 4, 'content.publish', org(4), key({ id: publicItem.id, expectedRevision: 1 }));
    await db.exec(`set role anon;select set_config('request.jwt.claim.sub','',false);`);
    const publicData = (await db.query<{ r: any }>('select public.content_public() r')).rows[0].r;
    assert.equal(publicData.items.length, 1);
    assert.equal(publicData.items[0].id, publicItem.id);
    assert(!JSON.stringify(publicData).includes('owner_id'));
  } finally {
    await db.close();
  }
});
