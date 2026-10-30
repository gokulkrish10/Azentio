import { NextResponse } from 'next/server';
import { userClient } from '@/server/supabase';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  const url = new URL(request.url),
    code = url.searchParams.get('code');
  if (code) {
    try {
      const db = await userClient();
      const { error } = await db.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL('/workspaces', process.env.APP_ORIGIN));
    } catch {}
  }
  return NextResponse.redirect(
    new URL('/login?error=verification', process.env.APP_ORIGIN || url.origin),
  );
}
