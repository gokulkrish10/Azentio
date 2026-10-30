import { actionSchemas, type Action, uuid } from '@/shared/contracts';
import { portal } from '@/server/portal';
import { body, failure, HttpError, json, originCheck } from '@/server/http';
import { z } from 'zod';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const envelope = z.object({ workspaceId: uuid.nullable(), payload: z.unknown() }).strict();
export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  try {
    originCheck(request);
    const { action } = await params;
    if (!Object.hasOwn(actionSchemas, action)) throw new HttpError(404, 'NOT_FOUND');
    const input = envelope.parse(await body(request));
    return json(await portal(action as Action, input.workspaceId, input.payload));
  } catch (e) {
    return failure(e);
  }
}
