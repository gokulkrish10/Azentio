// Local-only negative-access check. Does not send email or write hosted data.
const base = process.env.TEST_HTTP_ORIGIN || 'http://localhost:3000';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname))
  throw Error('Only loopback is permitted by this script');
const cases = [
  [
    '/api/portal/dashboard',
    { workspaceId: '10000000-0000-4000-8000-000000000001', payload: {} },
    401,
  ],
  [
    '/api/portal/moderation.list',
    { workspaceId: '10000000-0000-4000-8000-000000000004', payload: {} },
    401,
  ],
  [
    '/api/aira',
    {
      workspaceId: '10000000-0000-4000-8000-000000000001',
      question: 'What is the seasonal evidence?',
    },
    401,
  ],
  ['/api/portal/unknown', { workspaceId: null, payload: {} }, 404],
];
for (const [path, payload, expected] of cases) {
  const r = await fetch(base + path, {
    method: 'POST',
    headers: { origin: base, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const d = await r.json();
  console.log(`${path}: ${r.status} ${d.error?.code}`);
  if (r.status !== expected) process.exitCode = 1;
}
const bad = await fetch(base + '/api/portal/dashboard', {
  method: 'POST',
  headers: { origin: 'https://attacker.invalid', 'Content-Type': 'application/json' },
  body: '{}',
});
console.log(`foreign-origin: ${bad.status}`);
if (bad.status !== 403) process.exitCode = 1;
const deniedPage = await fetch(base + '/workspace/10000000-0000-4000-8000-000000000001', {
  redirect: 'manual',
});
console.log(
  `unauthenticated workspace: ${deniedPage.status} redirect ${deniedPage.headers.get('location')}`,
);
if (![303, 307].includes(deniedPage.status) || deniedPage.headers.get('location') !== '/login')
  process.exitCode = 1;
