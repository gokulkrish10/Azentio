import { OfferingCards } from '@/components/public/OfferingCards';
export const metadata = { title: 'Offerings' };
export default function Catalogue() {
  return (
    <>
      <div className="page-intro">
        <span className="eyebrow">The offering collection</span>
        <h1>Explore the possibilities.</h1>
        <p className="lead">
          A starting point for conversations about financial insight, document workflows and
          reporting.
        </p>
      </div>
      <OfferingCards />
      <p className="message">
        This hackathon catalogue introduces illustrative offerings. The available sandbox is a
        synthetic seasonal cash-flow comparison; access depends on your workspace’s entitlements.
      </p>
    </>
  );
}
