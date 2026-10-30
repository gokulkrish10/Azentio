'use client';
import { useRouter } from 'next/navigation';
import { usePortalMutation } from './usePortalQuery';
export function SharingAcknowledgement({ workspaceId }: { workspaceId: string }) {
  const mutation = usePortalMutation(workspaceId),
    router = useRouter();
  return (
    <section className="panel">
      <span className="eyebrow">Before your first contribution</span>
      <h2>Your workspace and your sharing choices</h2>
      <p>
        Use synthetic data in this hackathon. A saved observation starts privately unless you
        explicitly choose organisation visibility. Community publication requires your separate
        permission and moderator review.
      </p>
      <p className="muted">
        Joining or acknowledging this explanation does not consent to community publication,
        attribution or model training. Withdrawal prevents future shared access; already viewed or
        copied content cannot automatically be recalled.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void mutation.mutate(
            'onboarding.acknowledge',
            { version: 'sharing-v1', understood: true },
            'Sharing explanation acknowledged.',
            () => router.refresh(),
          );
        }}
      >
        <label className="check">
          <input type="checkbox" required />I understand the visibility and sharing choices.
        </label>
        <button disabled={mutation.busy}>Acknowledge and continue</button>
      </form>
      {mutation.message && (
        <p role="status" className={`message ${mutation.failed ? 'error' : ''}`}>
          {mutation.message}
        </p>
      )}
      <p className="subtle-note">
        Sharing explanation version sharing-v1. Organisation-approved workspace terms must be
        supplied separately; this explanation is not a legal agreement.
      </p>
    </section>
  );
}
