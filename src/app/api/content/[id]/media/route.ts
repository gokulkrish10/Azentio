import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { portal } from '@/server/portal';
import { identity } from '@/server/auth';
import { authConfig } from '@/server/supabase';
import { failure, HttpError, json, originCheck } from '@/server/http';
import { uuid } from '@/shared/contracts';
import type { Database } from '@/shared/database.types';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const maxSize = 20 * 1024 * 1024;
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    uuid.parse(id);
    const workspace = new URL(request.url).searchParams.get('workspaceId');
    let path: string, type: string, db;
    if (workspace) {
      uuid.parse(workspace);
      const asset = await portal('content.asset', workspace, { id });
      path = asset.path;
      type = asset.type;
      db = (await identity()).db;
    } else {
      const config = authConfig();
      db = createClient<Database>(config.url, config.key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await db.rpc('content_public', { p_id: id });
      const item = (
        data as unknown as { items: { mediaPath: string | null; mediaType: string | null }[] }
      )?.items?.[0];
      if (error || !item?.mediaPath || !item.mediaType) throw new HttpError(404, 'NOT_FOUND');
      path = item.mediaPath;
      type = item.mediaType;
    }
    if (!['video/mp4', 'video/webm', 'application/pdf'].includes(type))
      throw new HttpError(404, 'NOT_FOUND');
    const { data, error } = await db.storage.from('portal-media').download(path);
    if (error || !data || data.size > maxSize) throw new HttpError(404, 'MEDIA_UNAVAILABLE');
    const bytes = new Uint8Array(await data.arrayBuffer());
    const headers: Record<string, string> = {
      'Content-Type': type,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': 'bytes',
      'Content-Disposition':
        type === 'application/pdf' ? 'attachment; filename="resource.pdf"' : 'inline',
    };
    const range = request.headers.get('range');
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      const start = match ? Number(match[1]) : -1,
        end = match && match[2] ? Number(match[2]) : bytes.length - 1;
      if (start < 0 || start >= bytes.length || end < start || end >= bytes.length)
        return new Response(null, {
          status: 416,
          headers: { ...headers, 'Content-Range': `bytes */${bytes.length}` },
        });
      headers['Content-Range'] = `bytes ${start}-${end}/${bytes.length}`;
      headers['Content-Length'] = String(end - start + 1);
      return new Response(bytes.slice(start, end + 1), { status: 206, headers });
    }
    headers['Content-Length'] = String(bytes.length);
    return new Response(bytes, { headers });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    originCheck(request);
    const { id } = await params;
    uuid.parse(id);
    const workspace = new URL(request.url).searchParams.get('workspaceId');
    uuid.parse(workspace);
    const allowed = await portal('content.upload', workspace!, { id });
    if (!request.headers.get('content-type')?.startsWith('multipart/form-data'))
      throw new HttpError(415, 'MULTIPART_REQUIRED');
    // Bound the stream before parsing multipart; content-length alone is untrusted.
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError(400, 'FILE_REQUIRED');
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      while (true) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.length;
        if (size > maxSize + 1024 * 1024) {
          await reader.cancel();
          throw new HttpError(413, 'FILE_TOO_LARGE');
        }
        chunks.push(part.value);
      }
    } finally {
      reader.releaseLock();
    }
    const buffer = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }
    const form = await new Response(buffer, {
      headers: { 'Content-Type': request.headers.get('content-type')! },
    }).formData();
    const file = form.get('file');
    if (!(file instanceof File) || !file.size || file.size > maxSize)
      throw new HttpError(400, 'INVALID_FILE');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const valid =
      (file.type === 'application/pdf' &&
        new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-') ||
      (file.type === 'video/mp4' && new TextDecoder().decode(bytes.slice(4, 8)) === 'ftyp') ||
      (file.type === 'video/webm' &&
        bytes[0] === 0x1a &&
        bytes[1] === 0x45 &&
        bytes[2] === 0xdf &&
        bytes[3] === 0xa3);
    if (!valid) throw new HttpError(400, 'UNSUPPORTED_FILE');
    const path = `${id}/${randomUUID()}`,
      { db } = await identity();
    const upload = await db.storage
      .from('portal-media')
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (upload.error) throw new HttpError(503, 'MEDIA_UPLOAD_UNAVAILABLE');
    await portal('content.attach', workspace!, {
      id,
      expectedRevision: allowed.revision,
      path,
      type: file.type as 'video/mp4' | 'video/webm' | 'application/pdf',
      requestId: randomUUID(),
    });
    return json({ stored: true });
  } catch (error) {
    return failure(error);
  }
}
