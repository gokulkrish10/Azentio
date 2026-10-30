import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { database } from './database';
test('anonymous enquiries are write-only, idempotent and quota limited', async () => {
  const db = await database(false);
  try {
    await db.exec('set role anon');
    const send = (requestId: string) =>
      db.query<{ v: any }>('select public.enquire($1::jsonb) v', [
        {
          requestId,
          email: 'synthetic@example.invalid',
          name: 'Synthetic visitor',
          kind: 'demo',
          message: 'A synthetic demo enquiry.',
        },
      ]);
    const key = randomUUID();
    await send(key);
    const replay = await send(key);
    assert.equal(replay.rows[0].v.emailSent, false);
    await assert.rejects(() => db.query('select * from private.enquiries'), /permission denied/);
    for (let i = 0; i < 4; i++) await send(randomUUID());
    await assert.rejects(() => send(randomUUID()), /RATE_LIMITED/);
    await assert.rejects(
      () => db.query('select public.portal($1,$2,$3)', ['workspaces', null, {}]),
      /permission denied/,
    );
    await db.exec('reset role');
    assert.equal((await db.query('select * from private.enquiries')).rows.length, 5);
  } finally {
    await db.close();
  }
});
