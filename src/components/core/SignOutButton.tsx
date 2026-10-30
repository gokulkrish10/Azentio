'use client';
import { useState } from 'react';
export function SignOutButton() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <span>
      <button
        className="secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await fetch('/api/auth/logout', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            });
            if (!r.ok) throw Error();
            window.location.assign('/login');
          } catch {
            setError('Sign-out unavailable. Try again.');
            setBusy(false);
          }
        }}
      >
        {busy ? 'Signing out…' : 'Sign out'}
      </button>
      {error && <span role="alert"> {error}</span>}
    </span>
  );
}
