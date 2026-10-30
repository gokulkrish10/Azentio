// Read-only project connection check. Never prints keys, signs in, sends email or writes data.
import { createClient } from '@supabase/supabase-js';
try {
  process.loadEnvFile('.env.local');
} catch {
  /* Docker supplies these at runtime. */
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.log('NOT RUN: configure the Supabase project URL and publishable key locally.');
  process.exit(2);
}
let stage = 'Supabase Auth endpoint';
try {
  const settings = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: key },
    signal: AbortSignal.timeout(20000),
  });
  console.log('Auth endpoint HTTP status:', settings.status);
  if (settings.status !== 200) throw Error('AUTH_ENDPOINT');
  console.log('PASS: project URL and publishable key reach Supabase Auth (HTTP 200).');
  stage = 'anonymous portal RPC';
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await db
    .rpc('portal', {
      p_action: 'workspaces',
      p_workspace: null,
      p_payload: {},
    })
    .abortSignal(AbortSignal.timeout(20000));
  console.log('Anonymous RPC code:', error?.code || 'none');
  if (error?.code === 'PGRST202') {
    console.log(
      'NOT READY: application migrations have not been applied or schema cache has not refreshed.',
    );
    process.exitCode = 1;
  } else if (error?.code !== '42501') {
    throw Error('EXPECTED_ANONYMOUS_DENIAL');
  } else {
    console.log('PASS: application RPC exists and rejects anonymous execution (42501).');
  }
  stage = 'private schema exposure';
  const privateSchema = await db
    .schema('private')
    .from('organisations')
    .select('id')
    .limit(1)
    .abortSignal(AbortSignal.timeout(20000));
  console.log(
    'Private profile HTTP status/code:',
    privateSchema.status,
    privateSchema.error?.code || 'none',
  );
  if (privateSchema.status !== 406 || privateSchema.error?.code !== 'PGRST106')
    throw Error('PRIVATE_SCHEMA_EXPOSURE');
  console.log('PASS: private application schema is not exposed through the Data API.');
} catch (error) {
  console.error(
    `Failed stage: ${stage}; error class: ${error.name}; transport code: ${error.cause?.code || 'none'}`,
  );
  console.error(
    'FAIL: connection/security check. Inspect local setup without printing credentials.',
  );
  process.exitCode = 1;
}
