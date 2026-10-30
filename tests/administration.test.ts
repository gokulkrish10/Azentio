import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { database, asUser, org, user } from './database';
test('administration needs a separate grant, denies self-promotion and client escalation, and audits changes without source bodies', async () => {
  const db = await database();
  const key = (p: object = {}) => ({ requestId: randomUUID(), ...p });
  try {
    await assert.rejects(() => asUser(db, 1, 'admin.organisations', org(1)), /FORBIDDEN/);
    await db.exec(
      `insert into private.role_grants values('${org(4)}','${user(4)}','portal.admin');`,
    );
    assert.equal((await asUser(db, 4, 'admin.organisations', org(4))).items.length, 4);
    await assert.rejects(
      () =>
        asUser(
          db,
          4,
          'admin.grant',
          org(4),
          key({
            organisationId: org(4),
            userId: user(4),
            capability: 'content.publish',
            enabled: true,
          }),
        ),
      /SELF_PRIVILEGE_CHANGE_DENIED/,
    );
    await assert.rejects(
      () =>
        asUser(
          db,
          4,
          'admin.grant',
          org(4),
          key({
            organisationId: org(1),
            userId: user(1),
            capability: 'learning.moderate',
            enabled: true,
          }),
        ),
      /ROLE_BOUNDARY_DENIED/,
    );
    await asUser(
      db,
      4,
      'admin.grant',
      org(4),
      key({ organisationId: org(1), userId: user(1), capability: 'sandbox.run', enabled: false }),
    );
    assert(!(await asUser(db, 1, 'dashboard', org(1))).capabilities.includes('sandbox.run'));
    await asUser(
      db,
      4,
      'admin.entitlement',
      org(4),
      key({
        organisationId: org(2),
        offeringId: 'financial-analysis-intelligence',
        enabled: false,
      }),
    );
    assert.equal((await asUser(db, 2, 'dashboard', org(2))).offerings.length, 0);
    const members = await asUser(db, 4, 'admin.members', org(4), { organisationId: org(1) });
    assert.equal(members.items[0].role, 'client_admin');
    const audit = await asUser(db, 4, 'admin.audit', org(4));
    assert(audit.items.some((a: any) => a.action === 'admin.entitlement'));
    assert(!JSON.stringify(audit).includes('SYNTHETIC private source'));
  } finally {
    await db.close();
  }
});
