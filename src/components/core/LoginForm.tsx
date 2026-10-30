'use client';
import { useState } from 'react';
export function LoginForm() {
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          const email = new FormData(e.currentTarget).get('email');
          const r = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });
          const d = await r.json();
          setMessage(
            d.message ||
              (d.error?.code === 'ORIGIN_DENIED'
                ? 'This page address does not match the configured sign-in address. Open the address provided by your organiser.'
                : r.status === 429
                  ? 'Sign-in requests are temporarily limited. Wait before trying again; contact your organiser if this continues.'
                  : 'Sign-in is unavailable. Ask your organiser to check your approved account and email delivery setup.'),
          );
        } catch {
          setMessage('Sign-in unavailable. Please try again.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor="email">Approved email address</label>
      <input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
      <p className="muted">
        Use the account approved for your organisation. Verification does not automatically create
        membership.
      </p>
      <button disabled={busy}>{busy ? 'Requesting…' : 'Request verification link'}</button>
      {message && (
        <p role="status" className="message">
          {message}
        </p>
      )}
    </form>
  );
}
