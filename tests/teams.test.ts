import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { database, asUser, org, user } from './database';
test('employee team spaces require explicit team membership and enforce owner-only roster changes', async () => {
  const db = await database();
  const key = (p: object = {}) => ({ requestId: randomUUID(), ...p });
  try {
    await db.exec(
      `insert into private.memberships values('${org(4)}','${user(5)}','employee',true,null,true);insert into private.role_grants values('${org(4)}','${user(5)}','observations.write');`,
    );
    await assert.rejects(
      () =>
        asUser(
          db,
          1,
          'teams.create',
          org(1),
          key({ name: 'Client team', description: 'Not an employee workspace.' }),
        ),
      /EMPLOYEE_REQUIRED/,
    );
    const payload = key({
      name: 'Seasonality team',
      description: 'Synthetic hackathon collaboration.',
    });
    const team = await asUser(db, 4, 'teams.create', org(4), payload);
    assert.equal((await asUser(db, 4, 'teams.create', org(4), payload)).id, team.id);
    await assert.rejects(
      () => asUser(db, 5, 'teams.get', org(4), { id: team.id }),
      /RESOURCE_DENIED/,
    );
    await asUser(db, 4, 'teams.add', org(4), key({ id: team.id, userId: user(5) }));
    await asUser(
      db,
      5,
      'teams.post',
      org(4),
      key({ id: team.id, body: 'Synthetic experiment discussion.' }),
    );
    assert.equal((await asUser(db, 4, 'teams.get', org(4), { id: team.id })).posts.length, 1);
    await assert.rejects(
      () => asUser(db, 5, 'teams.remove', org(4), key({ id: team.id, userId: user(4) })),
      /OWNER_REQUIRED/,
    );
    await assert.rejects(
      () => asUser(db, 4, 'teams.add', org(4), key({ id: team.id, userId: user(1) })),
      /VERIFIED_EMPLOYEE_REQUIRED/,
    );
    await asUser(db, 4, 'teams.remove', org(4), key({ id: team.id, userId: user(5) }));
    await assert.rejects(
      () => asUser(db, 5, 'teams.get', org(4), { id: team.id }),
      /RESOURCE_DENIED/,
    );
  } finally {
    await db.close();
  }
});
