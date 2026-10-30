import { LoginForm } from '@/components/core/LoginForm';
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const q = await searchParams;
  return (
    <div className="narrow">
      <span className="eyebrow">Verified access</span>
      <h1>Welcome back.</h1>
      <p className="muted">Sign in to your approved client or employee workspace.</p>
      <section className="panel">
        {q.error && (
          <p role="alert" className="message error">
            Verification failed or expired. Request a new link.
          </p>
        )}
        <LoginForm />
      </section>
    </div>
  );
}
