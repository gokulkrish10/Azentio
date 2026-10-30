import 'server-only';
import type { Action, ActionOutput } from '@/shared/contracts';
import { actionSchemas, sharedPublicationSchema } from '@/shared/contracts';
import type { Database, Json } from '@/shared/database.types';
import { identity } from './auth';
import { HttpError } from './http';
export async function portal<A extends Action>(
  action: A,
  workspaceId: string | null,
  input: unknown,
): Promise<ActionOutput[A]> {
  const parsed = actionSchemas[action].parse(input);
  const { db } = await identity();
  const args: Database['public']['Functions']['portal']['Args'] = {
    p_action: action,
    p_workspace: workspaceId,
    p_payload: parsed as Json,
  };
  const { data, error } = await db.rpc('portal', args);
  if (error) {
    const status =
      error.code === '28000'
        ? 401
        : error.code === '42501'
          ? 403
          : error.code === '40001'
            ? 409
            : ['22023', '22P02', '23514', '23502', '23505', '23503', '22007', '22008'].includes(
                  error.code,
                )
              ? 400
              : 503;
    throw new HttpError(
      status,
      status === 503
        ? 'SERVICE_UNAVAILABLE'
        : status === 403
          ? 'ACCESS_DENIED'
          : status === 409
            ? 'REVISION_CONFLICT'
            : status === 401
              ? 'SIGN_IN_REQUIRED'
              : 'INVALID_OPERATION',
    );
  }
  if (action === 'learning.list')
    return {
      ...(data as object),
      items: sharedPublicationSchema.array().parse((data as unknown as { items: unknown }).items),
    } as ActionOutput[A];
  return data as unknown as ActionOutput[A];
}
export async function evidence(workspaceId: string, ids?: string[]) {
  const { db } = await identity();
  const { data, error } = await db.rpc('portal', {
    p_action: ids ? 'learning.recheck' : 'learning.list',
    p_workspace: workspaceId,
    p_payload: ids ? { ids, pageSize: 8 } : { pageSize: 8 },
  });
  if (error) throw new HttpError(403, 'ACCESS_DENIED');
  return sharedPublicationSchema.array().parse((data as unknown as { items: unknown }).items);
}
