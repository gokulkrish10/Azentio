'use client';
export default function Error({ reset }: { reset: () => void }) {
  return (
    <section className="panel">
      <h2>This view couldn’t be loaded.</h2>
      <p className="muted">Your request could not be completed. Try loading the view again.</p>
      <button onClick={reset}>Try again</button>
    </section>
  );
}
