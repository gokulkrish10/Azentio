import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/shared/database.types';
try {
  process.loadEnvFile('.env.local');
} catch {
  /* Explicit smoke reports missing setup below. */
}
async function main() {
  const {
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
    TEST_SUPABASE_EMAIL: email,
    TEST_SUPABASE_PASSWORD: password,
    TEST_WORKSPACE_ID: workspace,
  } = process.env;
  if (!url || !key || !email || !password || !workspace) {
    console.log(
      'NOT RUN: hosted smoke requires configured Supabase URL/key, a legitimate verified test account and selected workspace.',
    );
    process.exitCode = 2;
    return;
  }
  const db = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) throw Error('AUTH');
    const { data: user } = await db.auth.getUser();
    if (!user.user?.email_confirmed_at) throw Error('UNVERIFIED');
    const { error: rpcError } = await db.rpc('portal', {
      p_action: 'dashboard',
      p_workspace: workspace,
      p_payload: {},
    });
    if (rpcError) throw Error('RPC');
    const anon = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: denied } = await anon.rpc('portal', {
      p_action: 'dashboard',
      p_workspace: workspace,
      p_payload: {},
    });
    if (!denied) throw Error('ANON_ACCESS');
    console.log(
      'PASS: hosted verified Auth, selected-workspace RPC and anonymous denial. This does not replace the full multi-account acceptance matrix.',
    );
  } catch {
    console.error(
      'FAIL: hosted smoke. Check approved test identity, credentials, migrations and membership. Values/errors intentionally omitted.',
    );
    process.exitCode = 1;
  } finally {
    await db.auth.signOut();
  }
}
main();
