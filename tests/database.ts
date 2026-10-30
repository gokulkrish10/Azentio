import { PGlite } from '@electric-sql/pglite';
import { readFile, readdir } from 'node:fs/promises';
export const user = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const org = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export async function database(seed = true, storagePolicyFixture = false) {
  const db = new PGlite();
  // Test-only Auth compatibility layer. NEVER part of migrations or deployed builds.
  await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
  if (storagePolicyFixture)
    await db.exec(`
    -- Minimal test-only storage catalog for SQL-policy verification, not a Storage HTTP emulator.
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated,anon;
    grant select on storage.objects to authenticated,anon;
    grant insert on storage.objects to authenticated;
  `);
  for (const file of (await readdir('supabase/migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
  for (let n = 1; n <= 8; n++)
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())', [
      user(n),
      n === 4
        ? 'moderator@azentio.com'
        : n === 5
          ? 'employee@azentio.com'
          : `synthetic${n}@example.invalid`,
    ]);
  if (seed) {
    await db.exec(
      `set demo.client_a='${user(1)}';set demo.client_b='${user(2)}';set demo.client_c='${user(3)}';set demo.employee='${user(4)}';`,
    );
    await db.exec(await readFile('supabase/seed.sql', 'utf8'));
    // Explicitly acknowledged sharing-explanation fixtures, confined to this test database.
    await db.exec(
      `insert into private.workspace_acknowledgements(user_id,workspace_id,version) select user_id,organisation_id,'sharing-v1' from private.memberships where approved;`,
    );
  }
  return db;
}
export async function asUser(
  db: PGlite,
  n: number,
  action: string,
  workspace: string | null,
  payload: unknown = {},
) {
  await db.exec(`reset role; set role authenticated;`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [n ? user(n) : '']);
  try {
    return (
      await db.query<{ result: any }>('select public.portal($1,$2,$3::jsonb) result', [
        action,
        workspace,
        JSON.stringify(payload),
      ])
    ).rows[0].result;
  } finally {
    await db.exec('reset role');
  }
}
