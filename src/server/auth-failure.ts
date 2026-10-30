// Only known provider codes reach logs; never email addresses, tokens or raw SDK messages.
const knownCodes = new Set([
  'over_email_send_rate_limit',
  'over_request_rate_limit',
  'email_address_not_authorized',
  'email_address_invalid',
  'signup_disabled',
  'user_not_found',
  'email_provider_disabled',
  'unexpected_failure',
  'smtp_error',
]);
export function authFailure(error: unknown) {
  const value =
    error && typeof error === 'object' ? (error as { code?: unknown; status?: unknown }) : {};
  const code =
    typeof value.code === 'string' && knownCodes.has(value.code) ? value.code : 'provider_error';
  const upstreamStatus =
    typeof value.status === 'number' &&
    Number.isInteger(value.status) &&
    value.status >= 400 &&
    value.status <= 599
      ? value.status
      : 503;
  return { status: upstreamStatus === 429 ? 429 : 503, providerCode: code, upstreamStatus };
}
