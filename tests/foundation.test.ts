import {test} from 'node:test';
import assert from 'node:assert/strict';
import {database,asUser,org,user} from './database';
test('foundation: real SQL schema, RLS, verified membership and separate grants',async()=>{
 const db=await database();
 try {
  assert.equal((await asUser(db,1,'workspaces',null)).items.length,1);
  await assert.rejects(()=>asUser(db,0,'dashboard',org(1)),/SIGN_IN_REQUIRED/);
  await assert.rejects(()=>asUser(db,1,'dashboard',org(2)),/WORKSPACE_DENIED/);
  await assert.rejects(()=>asUser(db,1,'moderation.list',org(1)),/FORBIDDEN/);
  await db.exec(`insert into private.memberships values('${org(4)}','${user(5)}','employee',true,null,true);`);
  assert.equal((await asUser(db,5,'dashboard',org(4))).capabilities.length,0);
  await assert.rejects(()=>asUser(db,5,'moderation.list',org(4)),/FORBIDDEN/);
  await db.exec(`update private.memberships set revoked_at=now() where user_id='${user(1)}';`);
  await assert.rejects(()=>asUser(db,1,'dashboard',org(1)),/WORKSPACE_DENIED/);
  const r=await db.query<{n:number}>("select count(*)::integer n from pg_tables t join pg_class c on c.relname=t.tablename join pg_namespace n on n.oid=c.relnamespace and n.nspname=t.schemaname where t.schemaname='private' and not c.relrowsecurity");
  assert.equal(r.rows[0].n,0);
 } finally {await db.close();}
});
