import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { database, asUser, org, user } from './database';
test('storage object policies deny foreign inserts/reads and remove withdrawn media from future direct reads', async () => {
  const db = await database(true, true);
  const key = (p: object = {}) => ({ requestId: randomUUID(), ...p });
  try {
    await db.exec(
      `insert into private.role_grants values('${org(4)}','${user(4)}','broadcast.publish');`,
    );
    const item = await asUser(
      db,
      4,
      'content.save',
      org(4),
      key({
        kind: 'session',
        title: 'Synthetic internal recording',
        body: 'Synthetic employee session about governed collaboration.',
        audience: 'employee',
        ownerTeam: 'Synthetic broadcasts',
        reviewDate: '2026-12-01',
      }),
    );
    const path = `${item.id}/${randomUUID()}`;
    await db.exec('set role authenticated');
    await db.query("insert into storage.objects(bucket_id,name) values('portal-media',$1)", [path]);
    await db.exec('reset role');
    await asUser(
      db,
      4,
      'content.attach',
      org(4),
      key({ id: item.id, expectedRevision: 1, path, type: 'video/mp4' }),
    );
    await asUser(db, 4, 'content.publish', org(4), key({ id: item.id, expectedRevision: 1 }));
    await db.exec('set role authenticated');
    assert.equal((await db.query('select * from storage.objects')).rows.length, 1);
    await db.exec('reset role');
    await db.exec(
      `update auth.users set is_anonymous=true where id='${user(4)}';set role authenticated;`,
    );
    assert.equal(
      (await db.query('select * from storage.objects')).rows.length,
      0,
      'Direct Storage reads reject anonymous identities even if stale membership metadata exists.',
    );
    await db.exec(`reset role;update auth.users set is_anonymous=false where id='${user(4)}';`);
    await asUser(db, 1, 'dashboard', org(1));
    await db.exec('set role authenticated');
    assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
    await assert.rejects(
      () =>
        db.query("insert into storage.objects(bucket_id,name) values('portal-media',$1)", [
          `${item.id}/${randomUUID()}`,
        ]),
      /row-level security/,
    );
    await db.exec('reset role');
    await asUser(db, 4, 'content.withdraw', org(4), key({ id: item.id, expectedRevision: 1 }));
    await db.exec('set role authenticated');
    assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
  } finally {
    await db.close();
  }
});
