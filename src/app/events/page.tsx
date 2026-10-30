import { EnquiryForm } from '@/components/public/EnquiryForm';
export const metadata = { title: 'Hackathon interest' };
export default function Events() {
  return (
    <div className="split-layout enquiry-layout">
      <div>
        <span className="eyebrow">Employee innovation · Client perspective</span>
        <h1>
          Help shape
          <br />
          what comes next.
        </h1>
        <p className="lead">
          Express your interest in the azentio.ai hackathon and collaborative innovation.
        </p>
        <p className="muted">
          No event date or place is confirmed here. Registration records interest; session
          invitations and employee-only content require separately approved access.
        </p>
      </div>
      <section className="panel">
        <h2>Register your interest</h2>
        <EnquiryForm kind="event" />
      </section>
    </div>
  );
}
