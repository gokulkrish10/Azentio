import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actionSchemas, sharedPublicationSchema } from '../src/shared/contracts';
import { publicationFixture } from '../src/shared/fixtures';
import { body, HttpError, originCheck } from '../src/server/http';
test('shared allowlist refuses tenant/source/profile metadata and unsafe action input', () => {
  assert(sharedPublicationSchema.safeParse(publicationFixture).success);
  for (const field of [
    'organisation_id',
    'author_id',
    'observation_id',
    'internal_note',
    'attachments',
  ])
    assert(
      !sharedPublicationSchema.safeParse({ ...publicationFixture, [field]: 'private' }).success,
    );
  assert(!actionSchemas['themes.list'].safeParse({ region: 'rare region' }).success);
  assert(
    !actionSchemas['invitations.create'].safeParse({
      requestId: publicationFixture.id,
      intendedUserId: publicationFixture.id,
      role: 'employee',
    }).success,
  );
  assert(!actionSchemas['learning.list'].safeParse({ pageSize: 1000 }).success);
});
test('HTTP origin, streaming size and JSON validation fail closed', async () => {
  const old = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = 'http://localhost:3000';
  try {
    for (const origin of [undefined, 'https://attacker.invalid'])
      assert.throws(
        () =>
          originCheck(
            new Request('http://localhost:3000/api', { headers: origin ? { origin } : {} }),
          ),
        HttpError,
      );
    originCheck(
      new Request('http://localhost:3000/api', { headers: { origin: 'http://localhost:3000' } }),
    );
    await assert.rejects(
      () => body(new Request('http://localhost/api', { method: 'POST', body: 'x' })),
      /JSON_REQUIRED/,
    );
    await assert.rejects(
      () =>
        body(
          new Request('http://localhost/api', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: 'bad',
          }),
        ),
      /INVALID_JSON/,
    );
    await assert.rejects(
      () =>
        body(
          new Request('http://localhost/api', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: 'x'.repeat(24001),
          }),
        ),
      /BODY_TOO_LARGE/,
    );
  } finally {
    if (old === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = old;
  }
});
