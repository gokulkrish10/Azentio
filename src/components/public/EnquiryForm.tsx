'use client';
import { useRef, useState } from 'react';
import { enquirySchema } from '@/shared/contracts';
export function EnquiryForm({ kind }: { kind: 'demo' | 'event' }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const pending = useRef<{ signature: string; requestId: string } | null>(null);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const form = e.currentTarget,
          data = new FormData(form);
        const values = {
          name: String(data.get('name')),
          email: String(data.get('email')),
          message: String(data.get('message')),
          kind,
        };
        const signature = JSON.stringify(values);
        if (!pending.current || pending.current.signature !== signature)
          pending.current = { signature, requestId: crypto.randomUUID() };
        const parsed = enquirySchema.safeParse({ ...values, requestId: pending.current.requestId });
        if (!parsed.success) {
          setResult({
            ok: false,
            message: parsed.error.issues[0]?.message || 'Please check your details.',
          });
          return;
        }
        setBusy(true);
        setResult(null);
        try {
          const response = await fetch('/api/enquiries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(parsed.data),
          });
          const output = await response.json();
          if (!response.ok || output.stored !== true)
            throw new Error(
              response.status === 429
                ? 'The request limit has been reached. Please try again later.'
                : 'We could not save your request. Please try again.',
            );
          setResult({
            ok: true,
            message:
              kind === 'demo'
                ? 'Your demo enquiry has been received. No appointment is confirmed and no confirmation email has been sent.'
                : 'Your hackathon interest has been recorded. This is not a confirmed event place. No confirmation email has been sent.',
          });
          form.reset();
          pending.current = null;
        } catch (error) {
          setResult({
            ok: false,
            message:
              error instanceof Error ? error.message : 'The connection failed. Please try again.',
          });
        } finally {
          setBusy(false);
        }
      }}
    >
      <label htmlFor="enquiry-name">Your name</label>
      <input
        id="enquiry-name"
        name="name"
        autoComplete="name"
        required
        maxLength={120}
        disabled={busy}
      />
      <label htmlFor="enquiry-email">Email address</label>
      <input
        id="enquiry-email"
        name="email"
        type="email"
        autoComplete="email"
        required
        maxLength={254}
        disabled={busy}
      />
      <label htmlFor="enquiry-message">
        {kind === 'demo' ? 'What would you like to explore?' : 'Tell us about your interests'}
      </label>
      <textarea
        id="enquiry-message"
        name="message"
        required
        minLength={5}
        maxLength={2000}
        disabled={busy}
        placeholder="A few words about your area of interest…"
      />
      <p className="muted">
        Include only contact details needed for this enquiry. Do not submit customer records,
        credentials or confidential information.
      </p>
      <button disabled={busy}>
        {busy ? 'Submitting…' : kind === 'demo' ? 'Send demo enquiry →' : 'Register interest →'}
      </button>
      {result && (
        <p role={result.ok ? 'status' : 'alert'} className={`message ${result.ok ? '' : 'error'}`}>
          {result.message}
        </p>
      )}
    </form>
  );
}
