import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code);
  }
}
export function originCheck(request: Request) {
  const origin = request.headers.get('origin');
  const expected = process.env.APP_ORIGIN;
  if (!expected || origin !== expected) throw new HttpError(403, 'ORIGIN_DENIED');
}
export async function body(request: Request) {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new HttpError(415, 'JSON_REQUIRED');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'INVALID_JSON');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 24000) {
        await reader.cancel();
        throw new HttpError(413, 'BODY_TOO_LARGE');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const raw = new TextDecoder().decode(buffer);
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new HttpError(400, 'INVALID_JSON');
  }
}
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
export function failure(error: unknown) {
  if (error instanceof HttpError) return json({ error: { code: error.code } }, error.status);
  if (error instanceof ZodError)
    return json(
      {
        error: {
          code: 'INVALID_INPUT',
          fields: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        },
      },
      400,
    );
  return json({ error: { code: 'SERVICE_UNAVAILABLE' } }, 503);
}
