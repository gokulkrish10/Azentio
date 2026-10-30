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
  workspaces: z.object({}).strict(),
  dashboard: z.object({}).strict(),
  'observations.list': z.object(page).strict(),
  'observations.history': z.object({ ...page, id: uuid }).strict(),
  'observations.save': z
    .object({
      ...key,
      id: uuid.optional(),
      expectedRevision: z.number().int().positive().optional(),
      ...reviewed,
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
export interface Revision {
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
  workspaceId: string;
  capabilities: string[];
  offerings: { id: string; title: string }[];
  contributionCount: number;
  sessions: unknown[];
  experiments: unknown[];
  resources: unknown[];
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
  'themes.list': { items: Theme[] };
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
