import { z } from 'zod';
import { userClient } from '@/server/supabase';
import { body, failure, HttpError, json, originCheck } from '@/server/http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    originCheck(request);
    const { email } = z
      .object({ email: z.email().max(254) })
      .strict()
      .parse(await body(request));
    const db = await userClient();
    const { error } = await db.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${process.env.APP_ORIGIN}/auth/callback`,
      },
    });
    if (error) throw new HttpError(429, 'SIGN_IN_UNAVAILABLE');
    return json({
      message: 'If this approved account can sign in, check its email for a verification link.',
    });
  } catch (e) {
    return failure(e);
  }
}
