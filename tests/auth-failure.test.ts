import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authFailure } from '../src/server/auth-failure';
test('auth diagnostics distinguish throttling without logging identities, messages or unknown fields', () => {
  assert.equal(authFailure({ status: 429, code: 'over_email_send_rate_limit' }).status, 429);
  assert.equal(authFailure({ status: 400, code: 'email_address_not_authorized' }).status, 503);
  const safe = authFailure({
    status: 400,
    code: 'secret-token-value',
    message: 'person@example.invalid',
    access_token: 'secret',
  });
  assert.equal(safe.providerCode, 'provider_error');
  assert(!JSON.stringify(safe).includes('secret'));
  assert(!JSON.stringify(safe).includes('@'));
});
