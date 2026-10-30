import 'server-only';
import { userClient } from './supabase';
import { HttpError } from './http';
export async function identity() {
  const db = await userClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user || !data.user.email_confirmed_at || data.user.is_anonymous)
    throw new HttpError(401, 'SIGN_IN_REQUIRED');
  return { db, user: data.user };
}
