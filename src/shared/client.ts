import type { Action, ActionInput, ActionOutput } from './contracts';
export async function call<A extends Action>(
  action: A,
  workspaceId: string | null,
  payload: ActionInput<A>,
): Promise<ActionOutput[A]> {
  const r = await fetch(`/api/portal/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId, payload }),
    cache: 'no-store',
  });
  const d = await r.json();
  if (!r.ok)
    throw new Error(
      d.error?.fields
        ?.map((f: { path: string; message: string }) => `${f.path}: ${f.message}`)
        .join('; ') ||
        d.error?.code ||
        'Request failed',
    );
  return d;
}
