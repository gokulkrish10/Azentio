import { LoginForm } from '@/components/core/LoginForm';
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const q = await searchParams;
  return (
    <div className="split-layout enquiry-layout">
      <div>
        <span className="eyebrow">Verified access</span>
        <h1>Welcome back.</h1>
        <p className="muted">Sign in to your approved client or employee workspace.</p>
        <div className="editorial-list">
          <article>
            <span className="index-label">01</span>
            <div>
              <h2>Your organisation, your context</h2>
              <p className="muted">
                Choose an approved workspace after sign-in. Only its permitted offerings and
                contributions are available.
              </p>
            </div>
          </article>
          <article>
            <span className="index-label">02</span>
            <div>
              <h2>Private first. Shared with care.</h2>
              <p className="muted">
                Workspace membership does not give consent to publish your observations or use them
                for training.
              </p>
            </div>
          </article>
        </div>
      </div>
      <section className="panel">
        <h2>Sign in with email</h2>
        <p className="muted">
          Request a verification link for your approved account and open it in the same browser.
        </p>
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
