import { airaInput } from '@/shared/contracts';
import { aira } from '@/server/aira';
import { body, failure, json, originCheck } from '@/server/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export async function POST(request: Request) {
  try {
    originCheck(request);
    const { workspaceId, question } = airaInput.parse(await body(request));
    return json(await aira(workspaceId, question));
  } catch (e) {
    return failure(e);
  }
}
