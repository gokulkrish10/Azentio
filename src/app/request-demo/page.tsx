import { EnquiryForm } from '@/components/public/EnquiryForm';
export const metadata = { title: 'Request a demo' };
export default function Demo() {
  return (
    <div className="split-layout enquiry-layout">
      <div>
        <span className="eyebrow">Let’s explore together</span>
        <h1>
          Bring a question.
          <br />
          Start a conversation.
        </h1>
        <p className="lead">Tell us which offering or workflow you’d like to explore.</p>
        <p className="muted">
          The current hackathon preview includes a synthetic seasonal cash-flow scenario. Other
          catalogue areas are starting points for discussion.
        </p>
      </div>
      <section className="panel">
        <h2>Request a demo</h2>
        <p className="muted">
          Send an enquiry. Scheduling and availability need separate confirmation.
        </p>
        <EnquiryForm kind="demo" />
      </section>
    </div>
  );
}
