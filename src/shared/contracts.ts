import { z } from 'zod';
export const uuid = z.uuid();
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const page = {
  page: z.number().int().min(0).max(500).default(0),
  pageSize: z.number().int().min(1).max(50).default(20),
};
const key = { requestId: uuid };
const target = { ...key, id: uuid };
const date = z.iso.date();
const period = { periodStart: date, periodEnd: date };
export const observationCategories = [
  'market_observation',
  'emerging_trend',
  'product_gap',
  'operational_challenge',
  'successful_practice',
  'improvement_suggestion',
] as const;
export const learningFilters = z
  .object({
    query: text(0, 200).optional(),
    offeringId: text(1, 60).optional(),
    topic: text(1, 80).optional(),
    industry: text(1, 80).optional(),
    region: text(1, 80).optional(),
    periodStart: date.optional(),
    periodEnd: date.optional(),
  })
  .strict();
export const consentSchema = z
  .object({
    processing: z.literal(true),
    publication: z.boolean(),
    attribution: z.boolean().default(false),
    training: z.boolean().default(false),
  })
  .strict();
const reviewed = {
  title: text(5, 160),
  body: text(20, 6000),
  topic: text(1, 80),
  industry: text(1, 80),
  region: text(1, 80),
  ...period,
};
export const actionSchemas = {
  'admin.organisations': z.object({}).strict(),
  'admin.publisher': z
    .object({
      ...key,
      organisationId: uuid,
      userId: uuid,
      targetWorkspace: uuid,
      enabled: z.boolean(),
    })
    .strict(),
  'admin.audit': z.object({}).strict(),
  'admin.members': z.object({ organisationId: uuid }).strict(),
  'admin.organisation.create': z
    .object({ ...key, name: text(1, 120), kind: z.enum(['client', 'employee']) })
    .strict(),
  'admin.entitlement': z
    .object({ ...key, organisationId: uuid, offeringId: text(1, 60), enabled: z.boolean() })
    .strict(),
  'admin.grant': z
    .object({
      ...key,
      organisationId: uuid,
      userId: uuid,
      capability: z.enum([
        'observations.write',
        'learning.read',
        'learning.report',
        'learning.moderate',
        'content.publish',
        'broadcast.publish',
        'members.manage',
        'ideas.write',
        'sandbox.run',
      ]),
      enabled: z.boolean(),
    })
    .strict(),
  'admin.owner': z
    .object({
      ...key,
      organisationId: uuid,
      userId: uuid,
      offeringId: text(1, 60),
      enabled: z.boolean(),
    })
    .strict(),
  'teams.list': z.object({}).strict(),
  'teams.get': z.object({ id: uuid }).strict(),
  'teams.create': z.object({ ...key, name: text(3, 100), description: text(10, 2000) }).strict(),
  'teams.add': z.object({ ...target, userId: uuid }).strict(),
  'teams.remove': z.object({ ...target, userId: uuid }).strict(),
  'teams.post': z.object({ ...target, body: text(5, 3000) }).strict(),
  'content.list': z
    .object({ kind: z.enum(['session', 'resource', 'release_note', 'experiment']).optional() })
    .strict(),
  'content.get': z.object({ id: uuid }).strict(),
  'content.asset': z.object({ id: uuid }).strict(),
  'content.upload': z.object({ id: uuid }).strict(),
  'content.save': z
    .object({
      ...key,
      id: uuid.optional(),
      expectedRevision: z.number().int().positive().optional(),
      kind: z.enum(['session', 'resource', 'release_note', 'experiment']),
      title: text(5, 160),
      body: text(20, 12000),
      audience: z.enum(['public', 'employee', 'organisation']),
      targetWorkspace: uuid.optional(),
      offeringId: text(1, 60).optional(),
      ownerTeam: text(1, 120),
      reviewDate: date,
      startsAt: z.iso.datetime({ offset: true }).optional(),
    })
    .strict(),
  'content.publish': z
    .object({ ...target, expectedRevision: z.number().int().positive() })
    .strict(),
  'content.submit': z.object({ ...target, expectedRevision: z.number().int().positive() }).strict(),
  'content.withdraw': z
    .object({ ...target, expectedRevision: z.number().int().positive() })
    .strict(),
  'content.attach': z
    .object({
      ...target,
      expectedRevision: z.number().int().positive(),
      path: text(73, 73).regex(/^[a-f0-9-]{36}\/[a-f0-9-]{36}$/),
      type: z.enum(['video/mp4', 'video/webm', 'application/pdf']),
    })
    .strict(),
  'content.feedback': z.object({ ...target, rating: z.enum(['useful', 'needs_update']) }).strict(),
  workspaces: z.object({}).strict(),
  dashboard: z.object({}).strict(),
  'onboarding.acknowledge': z
    .object({ ...key, version: z.literal('sharing-v1'), understood: z.literal(true) })
    .strict(),
  'learning.configure': z
    .object({ ...key, minimumOrganisations: z.number().int().min(3).max(100) })
    .strict(),
  'bookmarks.list': z.object({}).strict(),
  'bookmarks.set': z.object({ ...target, saved: z.boolean() }).strict(),
  'searches.list': z.object({}).strict(),
  'searches.save': z.object({ ...key, name: text(1, 80), filters: learningFilters }).strict(),
  'searches.delete': z.object(target).strict(),
  'comments.list': z.object({ id: uuid }).strict(),
  'comments.queue': z.object({}).strict(),
  'comments.create': z
    .object({ ...target, body: text(5, 2000), publicationConsent: z.literal(true) })
    .strict(),
  'comments.withdraw': z.object(target).strict(),
  'comments.report': z.object({ ...target, reason: text(5, 1000) }).strict(),
  'comments.review': z
    .object({
      ...target,
      decision: z.enum(['publish', 'reject']),
      body: text(5, 2000).optional(),
      note: text(1, 1000),
    })
    .strict()
    .refine((v) => v.decision !== 'publish' || !!v.body, 'Reviewed comment text is required'),
  'feedback.set': z
    .object({ ...target, assessment: z.enum(['useful', 'needs_evidence']) })
    .strict(),
  'quality.get': z.object({ id: uuid }).strict(),
  'quality.set': z
    .object({
      ...target,
      quality: z.enum(['strong', 'limited', 'needs_evidence']),
      reason: text(5, 1000),
    })
    .strict(),
  'sandbox.runs': z.object({}).strict(),
  'sandbox.save': z
    .object({
      ...key,
      name: text(1, 120),
      offeringId: z.literal('financial-analysis-intelligence'),
    })
    .strict(),
  'sandbox.feedback': z
    .object({ ...target, rating: z.enum(['useful', 'needs_context']), feedback: text(0, 1000) })
    .strict(),
  'observations.list': z.object(page).strict(),
  'observations.history': z.object({ ...page, id: uuid }).strict(),
  'observations.save': z
    .object({
      ...key,
      id: uuid.optional(),
      expectedRevision: z.number().int().positive().optional(),
      ...reviewed,
      category: z.enum(observationCategories).default('market_observation'),
      offeringId: text(1, 60),
      evidenceType: z.enum(['synthetic scenario', 'operational observation', 'research summary']),
      confidence: z.enum(['low', 'medium', 'high']),
      evidenceUrl: z
        .union([
          z.literal(''),
          z
            .url()
            .max(1000)
            .refine((v) => {
              const u = new URL(v);
              return u.protocol === 'https:' && !u.username && !u.password;
            }, 'Use an HTTPS evidence link without credentials'),
        ])
        .optional(),
      audience: z.enum(['private', 'organisation']).default('private'),
      consent: consentSchema,
    })
    .strict()
    .refine((v) => v.periodEnd >= v.periodStart, 'Period end must follow start'),
  'observations.submit': z
    .object({ ...target, expectedRevision: z.number().int().positive() })
    .strict(),
  'observations.withdraw': z.object(target).strict(),
  'moderation.list': z.object(page).strict(),
  'moderation.decide': z
    .discriminatedUnion('decision', [
      z
        .object({
          ...target,
          expectedRevision: z.number().int().positive(),
          decision: z.literal('publish'),
          note: text(1, 2000),
          ...reviewed,
          attribution: text(1, 120).optional(),
        })
        .strict(),
      z
        .object({
          ...target,
          expectedRevision: z.number().int().positive(),
          decision: z.enum(['clarify', 'reject', 'suspend', 'withdraw']),
          note: text(1, 2000),
        })
        .strict(),
    ])
    .refine(
      (v) => v.decision !== 'publish' || v.periodEnd >= v.periodStart,
      'Period end must follow start',
    ),
  'learning.list': z
    .object({
      ...page,
      query: text(0, 200).optional(),
      offeringId: text(1, 60).optional(),
      topic: text(1, 80).optional(),
      industry: text(1, 80).optional(),
      region: text(1, 80).optional(),
      periodStart: date.optional(),
      periodEnd: date.optional(),
    })
    .strict(),
  'themes.list': z.object({ ...page, offeringId: text(1, 60).optional() }).strict(),
  'ideas.list': z.object(page).strict(),
  'ideas.create': z
    .object({
      ...key,
      title: text(5, 160),
      problem: text(20, 3000),
      offeringId: text(1, 60),
      outcome: text(10, 2000),
      team: text(1, 120),
      priority: z.enum(['low', 'medium', 'high']),
      evidence: z.array(uuid).min(1).max(20),
    })
    .strict(),
  'ideas.update': z
    .object({
      ...target,
      status: z.enum([
        'Proposed',
        'Under review',
        'Planned',
        'In progress',
        'Released',
        'Not proceeding',
      ]),
    })
    .strict(),
  'reports.create': z.object({ ...target, reason: text(5, 2000) }).strict(),
  'reports.resolve': z.object({ ...target, note: text(5, 2000), restore: z.boolean() }).strict(),
  'members.list': z.object({}).strict(),
  'members.revoke': z.object(target).strict(),
  'invitations.create': z
    .object({ ...key, intendedUserId: uuid, role: z.literal('client_member') })
    .strict(),
  'invitations.accept': z.object({ id: uuid }).strict(),
  'notifications.list': z.object(page).strict(),
  'notifications.read': z.object(target).strict(),
  'sandbox.run': z
    .object({ offeringId: text(1, 60), scenario: z.literal('seasonal-sme') })
    .strict(),
} as const;
export type Action = keyof typeof actionSchemas;
export type ActionInput<A extends Action> = z.input<(typeof actionSchemas)[A]>;
export const sharedPublicationSchema = z
  .object({
    id: uuid,
    title: z.string(),
    body: z.string(),
    offeringId: z.string(),
    topic: z.string(),
    industry: z.string(),
    region: z.string(),
    periodStart: z.string(),
    periodEnd: z.string(),
    evidenceType: z.string(),
    confidence: z.enum(['low', 'medium', 'high']),
    attribution: z.string().nullable(),
    publishedAt: z.string(),
  })
  .strict();
export type SharedPublication = z.infer<typeof sharedPublicationSchema>;
export interface Workspace {
  id: string;
  name: string;
  kind: 'client' | 'employee';
  role: 'client_member' | 'client_admin' | 'employee';
}
export interface ContentItem {
  id: string;
  kind: 'session' | 'resource' | 'release_note' | 'experiment';
  title: string;
  body: string;
  audience: 'public' | 'employee' | 'organisation';
  offeringId: string | null;
  ownerTeam: string;
  reviewDate: string;
  startsAt: string | null;
  revision: number;
  state: 'draft' | 'submitted' | 'published' | 'withdrawn';
  hasMedia: boolean;
  updatedAt: string;
  canEdit?: boolean;
  canPublish?: boolean;
  targetWorkspace?: string | null;
  mediaType?: string | null;
}
export interface Revision {
  category: (typeof observationCategories)[number];
  source_audience: 'private' | 'organisation';
  observation_id: string;
  version: number;
  title: string;
  body: string;
  offering_id: string;
  topic: string;
  industry: string;
  region: string;
  period_start: string;
  period_end: string;
  evidence_type: 'synthetic scenario' | 'operational observation' | 'research summary';
  confidence: 'low' | 'medium' | 'high';
  evidence_url: string | null;
}
export interface Observation {
  id: string;
  state: 'draft' | 'submitted' | 'clarification' | 'rejected' | 'published' | 'withdrawn';
  current_revision: number;
  submitted_revision: number | null;
  source_audience: 'private' | 'organisation';
  author_id: string;
  revision: Revision;
  decisions: { action: string; note: string; version: number; created_at: string }[];
}
export interface ReviewItem {
  id: string;
  state: string;
  submitted_revision: number;
  revision: Revision;
  consent: { attribution: boolean };
  reports: { id: string; publicationId: string; reason: string; state: string }[];
}
export interface Dashboard {
  onboarding?: { version: 'sharing-v1'; acknowledged: boolean };
  workspaceId: string;
  capabilities: string[];
  offerings: { id: string; title: string }[];
  contributionCount: number;
  sessions: ContentItem[];
  experiments: ContentItem[];
  resources: ContentItem[];
}
export interface Theme {
  id: string;
  title: string;
  offeringId: string;
  organisations: number;
  evidence: SharedPublication[];
  periodStart: string;
  periodEnd: string;
  updatedAt: string;
  limitations: string;
}
export interface Idea {
  id: string;
  title: string;
  problem: string;
  offeringId: string;
  outcome: string;
  team: string;
  priority: string;
  status: string;
  updatedAt: string;
  evidence: SharedPublication[];
}
export interface Notification {
  id: string;
  message: string;
  read_at: string | null;
  created_at: string;
}
export interface Member {
  id: string;
  role: string;
  approved: boolean;
  revokedAt: string | null;
}
export interface Invitation {
  id: string;
  intendedUserId: string;
  role: string;
  expiresAt: string;
  acceptedAt: string | null;
}
export interface MutationResult {
  id?: string;
  revision?: number;
  state?: string;
  publicationId?: string | null;
  ok?: boolean;
  stored?: boolean;
  emailSent?: false;
}
export interface ActionOutput {
  'admin.organisations': {
    items: { id: string; name: string; kind: string }[];
    offerings: { id: string; title: string }[];
  };
  'admin.members': {
    items: {
      id: string;
      role: string;
      approved: boolean;
      revoked: boolean;
      capabilities: string[];
    }[];
    entitlements: { offeringId: string; enabled: boolean }[];
  };
  'admin.audit': {
    items: {
      id: string;
      actor_id: string;
      organisation_id: string | null;
      action: string;
      resource_id: string | null;
      created_at: string;
    }[];
  };
  'admin.organisation.create': MutationResult;
  'admin.publisher': MutationResult;
  'admin.entitlement': MutationResult;
  'admin.grant': MutationResult;
  'admin.owner': MutationResult;
  'teams.list': { items: { id: string; name: string; description: string; owner: boolean }[] };
  'teams.get': {
    id: string;
    name: string;
    description: string;
    owner: boolean;
    members: { id: string; owner: boolean }[];
    posts: { id: string; body: string; own: boolean; createdAt: string }[];
  };
  'teams.create': MutationResult;
  'teams.add': MutationResult;
  'teams.remove': MutationResult;
  'teams.post': MutationResult;
  'content.list': { items: ContentItem[] };
  'content.get': ContentItem;
  'content.asset': { path: string; type: string };
  'content.upload': { id: string; revision: number };
  'content.save': MutationResult;
  'content.publish': MutationResult;
  'content.submit': MutationResult;
  'content.withdraw': MutationResult;
  'content.attach': MutationResult;
  'content.feedback': MutationResult;
  'onboarding.acknowledge': MutationResult;
  'learning.configure': MutationResult;
  'bookmarks.list': { items: SharedPublication[] };
  'bookmarks.set': MutationResult;
  'searches.list': {
    items: { id: string; name: string; filters: z.infer<typeof learningFilters> }[];
  };
  'searches.save': MutationResult;
  'searches.delete': MutationResult;
  'comments.list': {
    items: {
      id: string;
      body: string;
      state: string;
      own: boolean;
      decision: string | null;
      createdAt: string;
    }[];
  };
  'comments.queue': {
    items: {
      id: string;
      publicationId: string;
      publicationTitle: string;
      body: string;
      state: string;
      reports: string[];
      created_at: string;
    }[];
  };
  'comments.create': MutationResult;
  'comments.withdraw': MutationResult;
  'comments.report': MutationResult;
  'comments.review': MutationResult;
  'feedback.set': MutationResult;
  'quality.get': {
    assessment: { quality: string; reason: string; updatedAt: string } | null;
    yourFeedback: 'useful' | 'needs_evidence' | null;
  };
  'quality.set': MutationResult;
  'sandbox.runs': {
    items: {
      id: string;
      name: string;
      offeringId: string;
      result: ActionOutput['sandbox.run'];
      rating: string | null;
      feedback: string | null;
      created_at: string;
    }[];
  };
  'sandbox.save': MutationResult;
  'sandbox.feedback': MutationResult;
  workspaces: { items: Workspace[] };
  dashboard: Dashboard;
  'observations.list': { items: Observation[] };
  'observations.history': {
    items: (Revision & {
      consent: {
        processing: boolean;
        publication: boolean;
        attribution: boolean;
        training: boolean;
      };
    })[];
  };
  'observations.save': MutationResult;
  'observations.submit': MutationResult;
  'observations.withdraw': MutationResult;
  'moderation.list': { items: ReviewItem[] };
  'moderation.decide': MutationResult;
  'learning.list': { items: SharedPublication[]; page: number; pageSize: number };
  'themes.list': { items: Theme[]; minimumOrganisations: number };
  'ideas.list': { items: Idea[] };
  'ideas.create': MutationResult;
  'ideas.update': MutationResult;
  'reports.create': MutationResult;
  'reports.resolve': MutationResult;
  'members.list': { items: Member[]; invitations: Invitation[] };
  'members.revoke': MutationResult;
  'invitations.create': MutationResult;
  'invitations.accept': { accepted: true };
  'notifications.list': { items: Notification[] };
  'notifications.read': MutationResult;
  'sandbox.run': {
    synthetic: true;
    simulated: true;
    message: string;
    inputs: { scenario: string; quarterlyValues: number[] };
  };
}
export const enquirySchema = z
  .object({
    ...key,
    email: z.email().max(254),
    name: text(1, 120),
    kind: z.enum(['demo', 'event']),
    message: text(5, 2000),
  })
  .strict();
export const airaInput = z.object({ workspaceId: uuid, question: text(5, 500) }).strict();
export const airaAnswer = z
  .object({
    statements: z
      .array(z.object({ text: text(1, 1200), citations: z.array(uuid).min(1).max(8) }).strict())
      .min(1)
      .max(5),
    uncertainty: text(1, 500),
  })
  .strict();
export type AiraResult =
  | { status: 'answered'; answer: z.infer<typeof airaAnswer>; evidence: SharedPublication[] }
  | { status: 'unavailable' | 'insufficient_evidence'; message: string };
