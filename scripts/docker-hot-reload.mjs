// Reversible loopback-only check for the Compose bind mount and Next.js hot reload.
import { readFile, writeFile } from 'node:fs/promises';
const origin = process.env.TEST_HTTP_ORIGIN || 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) throw Error('Loopback only');
const path = new URL('../src/app/page.tsx', import.meta.url);
const original = await readFile(path, 'utf8');
const phrase = 'Turn observations into shared progress.';
if (!original.includes(phrase))
  throw Error('Homepage changed; update this verification probe first');
const marker = `Docker runtime probe ${Date.now()}`;
const changed = original.replace(phrase, marker);
async function rendered(text) {
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    const response = await fetch(origin, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    const html = await response.text();
    if (response.status === 200 && html.includes(text)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw Error('Hot reload did not reach expected content within 25 seconds');
}
try {
  await writeFile(path, changed);
  await rendered(marker);
  console.log('PASS: host source change reached the container-served homepage through hot reload.');
} finally {
  if ((await readFile(path, 'utf8')) !== changed)
    throw Error('Concurrent homepage edit detected; source preserved.');
  await writeFile(path, original);
}
await rendered(phrase);
console.log('PASS: original homepage restored and served successfully.');
