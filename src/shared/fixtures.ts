import type { SharedPublication } from './contracts';
// Presentation-only synthetic contract fixture. Never wired into authentication or production APIs.
export const publicationFixture: SharedPublication = {
  id: '30000000-0000-4000-8000-000000000001',
  title: 'Seasonality context in SME comparisons',
  body: 'Synthetic seasonal cash-flow observations suggest comparing equivalent periods and explaining seasonal effects. This limited evidence is not a market prevalence estimate.',
  offeringId: 'financial-analysis-intelligence',
  topic: 'seasonality',
  industry: 'Financial services',
  region: 'Broad synthetic region',
  periodStart: '2026-01-01',
  periodEnd: '2026-06-30',
  evidenceType: 'synthetic scenario',
  confidence: 'medium',
  attribution: null,
  publishedAt: '2026-10-30T00:00:00Z',
};

import type { Dashboard, Workspace, Theme, Idea, Notification } from './contracts';
export const workspaceFixture: Workspace = {
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Synthetic Cedar Finance',
  kind: 'client',
  role: 'client_member',
};
export const dashboardFixture: Dashboard = {
  workspaceId: workspaceFixture.id,
  capabilities: ['observations.write', 'learning.read', 'learning.report', 'sandbox.run'],
  offerings: [{ id: 'financial-analysis-intelligence', title: 'Financial Analysis Intelligence' }],
  contributionCount: 1,
  sessions: [],
  experiments: [],
  resources: [],
};
export const themeFixture: Theme = {
  id: 'seasonality-context',
  title: 'Seasonality context',
  offeringId: publicationFixture.offeringId,
  organisations: 3,
  evidence: [
    publicationFixture,
    { ...publicationFixture, id: '30000000-0000-4000-8000-000000000002' },
    { ...publicationFixture, id: '30000000-0000-4000-8000-000000000003' },
  ],
  periodStart: publicationFixture.periodStart,
  periodEnd: publicationFixture.periodEnd,
  updatedAt: publicationFixture.publishedAt,
  limitations:
    'Synthetic three-organisation example, not market prevalence or a privacy guarantee.',
};
export const ideaFixture: Idea = {
  id: '50000000-0000-4000-8000-000000000001',
  title: 'Explain seasonality-aware comparisons',
  problem:
    'Synthetic evidence suggests seasonal differences can be mistaken for underlying performance changes.',
  offeringId: publicationFixture.offeringId,
  outcome: 'Explain equivalent-period comparisons with seasonality context.',
  team: 'Financial Analysis team',
  priority: 'medium',
  status: 'Under review',
  updatedAt: publicationFixture.publishedAt,
  evidence: themeFixture.evidence,
};
export const notificationFixture: Notification = {
  id: '60000000-0000-4000-8000-000000000001',
  message: 'Your observation review status changed. Open your observations for details.',
  read_at: null,
  created_at: publicationFixture.publishedAt,
};
