import { sql } from "drizzle-orm";
import {
  pgTable,
  check,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  uuid,
  real,
  index,
  uniqueIndex,
  primaryKey,
  vector,
  date,
  bigint,
  foreignKey,
} from "drizzle-orm/pg-core";
const created = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const id = () => uuid("id").defaultRandom().primaryKey();
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  role: text("role").default("user").notNull(),
  createdAt: created(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: created(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);
export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: created(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("accounts_provider_idx").on(t.providerId, t.accountId)],
);
export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: created(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);
export const sources = pgTable("sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  config: jsonb("config").notNull().default({}),
  health: text("health").default("unknown").notNull(),
  lastCollectedAt: timestamp("last_collected_at", { withTimezone: true }),
  collectionState:
    jsonb("collection_state").$type<
      import("@/lib/sources/types").CollectionState
    >(),
  lastError: text("last_error"),
});
export const rawSignals = pgTable(
  "raw_signals",
  {
    id: id(),
    source: text("source")
      .notNull()
      .references(() => sources.id),
    externalId: text("external_id").notNull(),
    url: text("url").notNull(),
    author: text("author").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    discoveredAt: created(),
    language: text("language").notNull(),
    engagement: integer("engagement").default(0).notNull(),
    metadata: jsonb("metadata").default({}).notNull(),
    contentHash: text("content_hash").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
    embeddingModel: text("embedding_model").default("openai:legacy").notNull(),
    duplicateOf: uuid("duplicate_of"),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("signal_external_idx").on(t.source, t.externalId),
    uniqueIndex("signal_url_idx").on(t.url),
    uniqueIndex("signal_hash_idx").on(t.contentHash),
    index("signal_date_idx").on(t.publishedAt),
    index("signal_pending_idx").on(t.processedAt),
    index("signal_retention_idx").on(t.retiredAt, t.publishedAt),
    check(
      "signal_retired_payload_check",
      sql`${t.retiredAt} is null or (${t.author}='' and ${t.title}='' and ${t.content}='' and ${t.metadata}='{}'::jsonb and ${t.embedding} is null)`,
    ),
  ],
);
export const painClusters = pgTable("pain_clusters", {
  id: id(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  category: text("category").notNull(),
  industry: text("industry").notNull(),
  audience: text("audience").notNull(),
  keywords: jsonb("keywords").$type<string[]>().default([]).notNull(),
  embedding: vector("embedding", { dimensions: 1536 }),
  embeddingModel: text("embedding_model").default("openai:legacy").notNull(),
  analysis: jsonb("analysis")
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
  createdAt: created(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const clusterSignals = pgTable(
  "cluster_signals",
  {
    clusterId: uuid("cluster_id")
      .notNull()
      .references(() => painClusters.id, { onDelete: "cascade" }),
    signalId: uuid("signal_id")
      .notNull()
      .references(() => rawSignals.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.clusterId, t.signalId] }),
    uniqueIndex("signal_one_cluster").on(t.signalId),
  ],
);
export const opportunities = pgTable(
  "opportunities",
  {
    id: id(),
    clusterId: uuid("cluster_id")
      .notNull()
      .unique()
      .references(() => painClusters.id, { onDelete: "cascade" }),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    industry: text("industry").notNull(),
    audience: text("audience").notNull(),
    score: real("score").default(0).notNull(),
    confidence: text("confidence").default("Low").notNull(),
    mentions: integer("mentions").default(0).notNull(),
    growth7d: real("growth_7d"),
    growth30d: real("growth_30d"),
    status: text("status").default("New").notNull(),
    components: jsonb("components").default({}).notNull(),
    analysis: jsonb("analysis")
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    mvp: jsonb("mvp").$type<Record<string, unknown>>(),
    public: boolean("public").default(true).notNull(),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("opportunity_score_idx").on(t.score),
    index("opportunity_page_idx").on(t.score.desc(), t.id.asc()),
    index("opportunity_industry_idx").on(t.industry),
  ],
);
export const opportunitySnapshots = pgTable(
  "opportunity_snapshots",
  {
    id: id(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    score: real("score").notNull(),
    mentions: integer("mentions").notNull(),
    velocity: real("velocity"),
    rank: integer("rank").notNull(),
    confidence: text("confidence").notNull(),
  },
  (t) => [
    uniqueIndex("snapshot_daily_idx").on(t.opportunityId, t.day),
    index("snapshot_day_idx").on(t.day),
  ],
);
export const trends = pgTable("trends", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  createdAt: created(),
});
export const trendOpportunities = pgTable(
  "trend_opportunities",
  {
    trendId: uuid("trend_id")
      .notNull()
      .references(() => trends.id, { onDelete: "cascade" }),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.trendId, t.opportunityId] })],
);
export const radars = pgTable(
  "radars",
  {
    id: id(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    excludedWords: jsonb("excluded_words")
      .$type<string[]>()
      .default([])
      .notNull(),
    industries: jsonb("industries").$type<string[]>().default([]).notNull(),
    sources: jsonb("sources").$type<string[]>().default([]).notNull(),
    languages: jsonb("languages").$type<string[]>().default(["en"]).notNull(),
    alertThreshold: integer("alert_threshold").default(60).notNull(),
    frequency: text("frequency").default("daily").notNull(),
    createdAt: created(),
  },
  (t) => [index("radar_user_idx").on(t.userId)],
);
export const radarKeywords = pgTable(
  "radar_keywords",
  {
    radarId: uuid("radar_id")
      .notNull()
      .references(() => radars.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
  },
  (t) => [primaryKey({ columns: [t.radarId, t.keyword] })],
);
export const watchlists = pgTable("watchlists", {
  id: id(),
  workspaceId: uuid("workspace_id")
    .unique()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").default("My watchlist").notNull(),
});
export const watchlistItems = pgTable(
  "watchlist_items",
  {
    watchlistId: uuid("watchlist_id")
      .notNull()
      .references(() => watchlists.id, { onDelete: "cascade" }),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
    lastViewedScore: real("last_viewed_score"),
    createdAt: created(),
  },
  (t) => [primaryKey({ columns: [t.watchlistId, t.opportunityId] })],
);
export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dedupeKey: text("dedupe_key").notNull().unique(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    opportunityId: uuid("opportunity_id").references(() => opportunities.id, {
      onDelete: "set null",
    }),
    readAt: timestamp("read_at", { withTimezone: true }),
    emailedAt: timestamp("emailed_at", { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [index("notification_user_idx").on(t.userId, t.createdAt)],
);
export const reports = pgTable(
  "reports",
  {
    id: id(),
    period: text("period").notNull(),
    startDay: date("start_day").notNull(),
    endDay: date("end_day").notNull(),
    content: jsonb("content").notNull(),
    createdAt: created(),
  },
  (t) => [uniqueIndex("report_period_idx").on(t.period, t.endDay)],
);
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    customerId: text("customer_id").unique(),
    subscriptionId: text("subscription_id").unique(),
    plan: text("plan").default("free").notNull(),
    status: text("status").default("inactive").notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    providerCreatedAt: timestamp("provider_created_at", { withTimezone: true }),
    syncGeneration: bigint("sync_generation", { mode: "number" })
      .default(0)
      .notNull(),
    reconciledAt: timestamp("reconciled_at", { withTimezone: true }),
    reconciliationNextAt: timestamp("reconciliation_next_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    reconciliationLeaseToken: uuid("reconciliation_lease_token"),
    reconciliationLeaseUntil: timestamp("reconciliation_lease_until", {
      withTimezone: true,
    }),
    reconciliationError: text("reconciliation_error"),
    reconciliationFailures: integer("reconciliation_failures")
      .default(0)
      .notNull(),
    lastReconciliationId: uuid("last_reconciliation_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("subscription_reconciliation_due_idx").on(
      t.reconciliationNextAt,
      t.userId,
    ),
  ],
);
export const invoices = pgTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id").notNull(),
    amountPaid: integer("amount_paid").notNull(),
    currency: text("currency").notNull(),
    status: text("status"),
    url: text("url"),
    createdAt: created(),
    providerCreatedAt: timestamp("provider_created_at", { withTimezone: true }),
    observedAt: timestamp("observed_at", { withTimezone: true }),
  },
  (t) => [
    index("invoice_customer_created_idx").on(
      t.customerId,
      t.providerCreatedAt,
      t.id,
    ),
  ],
);
export const invoiceReconciliationQueue = pgTable(
  "invoice_reconciliation_queue",
  {
    customerId: text("customer_id").primaryKey(),
    cursor: text("cursor"),
    frozenUntil: timestamp("frozen_until", { withTimezone: true }),
    nextAt: timestamp("next_at", { withTimezone: true }).defaultNow().notNull(),
    leaseToken: uuid("lease_token"),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    failures: integer("failures").default(0).notNull(),
    error: text("error"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("invoice_reconciliation_due_idx").on(t.nextAt)],
);
export const invoiceSyncState = pgTable("invoice_sync_state", {
  id: text("id").primaryKey(),
  customerId: text("customer_id").notNull(),
  generation: bigint("generation", { mode: "number" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const apiKeys = pgTable("api_keys", {
  id: id(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, {
    onDelete: "cascade",
  }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  hash: text("hash").notNull().unique(),
  prefix: text("prefix").notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: created(),
});
export const auditLogs = pgTable("audit_logs", {
  id: id(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: created(),
});
export const aiCache = pgTable(
  "ai_cache",
  {
    key: text("key").primaryKey(),
    kind: text("kind").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: created(),
  },
  (t) => [index("ai_cache_created_idx").on(t.createdAt)],
);
export const aiUsage = pgTable("ai_usage", {
  id: id(),
  jobId: text("job_id").notNull(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  costMicros: bigint("cost_micros", { mode: "number" }),
  createdAt: created(),
});
export const jobRuns = pgTable(
  "job_runs",
  {
    id: text("id").primaryKey(),
    job: text("job").notNull(),
    status: text("status").notNull(),
    error: text("error"),
    createdAt: created(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("job_finished_idx").on(t.finishedAt)],
);
export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(),
  createdAt: created(),
});
export const billingObservation = pgTable("billing_observation", {
  id: text("id").primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const subscriptionHistory = pgTable(
  "subscription_history",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: text("event_id")
      .unique()
      .references(() => webhookEvents.id),
    reconciliationId: uuid("reconciliation_id").unique(),
    eventType: text("event_type").notNull(),
    eventCreatedAt: timestamp("event_created_at", { withTimezone: true }),
    observedAt: timestamp("observed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    generation: bigint("generation", { mode: "number" }).default(0).notNull(),
    subscriptionId: text("subscription_id"),
    plan: text("plan").notNull(),
    status: text("status").notNull(),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull(),
    applied: boolean("applied").notNull(),
    transition: text("transition").notNull(),
    wasPaid: boolean("was_paid").notNull(),
    isPaid: boolean("is_paid").notNull(),
  },
  (t) => [
    index("subscription_history_user_time_idx").on(
      t.userId,
      t.observedAt,
      t.generation,
    ),
    index("subscription_history_time_idx").on(t.observedAt),
  ],
);
export const dailyUsage = pgTable(
  "daily_usage",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    opportunityId: uuid("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day, t.opportunityId] })],
);

export const rateLimits = pgTable("rate_limits", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

export const aiBudgets = pgTable("ai_budgets", {
  day: date("day").primaryKey(),
  spentMicros: bigint("spent_micros", { mode: "number" }).default(0).notNull(),
});

export const competitorResearch = pgTable("competitor_research", {
  opportunityId: uuid("opportunity_id")
    .primaryKey()
    .references(() => opportunities.id, { onDelete: "cascade" }),
  results: jsonb("results").$type<Record<string, unknown>[]>().notNull(),
  sources: jsonb("sources").$type<string[]>().notNull(),
  researchedAt: timestamp("researched_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const teams = pgTable("teams", {
  id: id(),
  ownerId: text("owner_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  createdAt: created(),
});
export const teamMembers = pgTable(
  "team_members",
  {
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<"admin" | "member">().notNull().default("member"),
    createdAt: created(),
  },
  (t) => [
    primaryKey({ columns: [t.teamId, t.userId] }),
    index("team_members_user_idx").on(t.userId),
  ],
);
export const teamInvites = pgTable(
  "team_invites",
  {
    id: id(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").$type<"admin" | "member">().notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [index("invite_team_idx").on(t.teamId)],
);
export const workspaces = pgTable(
  "workspaces",
  {
    id: id(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    clientName: text("client_name").notNull(),
    brandName: text("brand_name").notNull(),
    brandColor: text("brand_color").default("#a58bff").notNull(),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("workspace_team_pair_idx").on(t.id, t.teamId),
    index("workspace_team_idx").on(t.teamId),
  ],
);
export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id").notNull(),
    teamId: uuid("team_id").notNull(),
    userId: text("user_id").notNull(),
    role: text("role").$type<"editor" | "viewer">().notNull(),
    createdAt: created(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.userId] }),
    foreignKey({
      columns: [t.workspaceId, t.teamId],
      foreignColumns: [workspaces.id, workspaces.teamId],
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.teamId, t.userId],
      foreignColumns: [teamMembers.teamId, teamMembers.userId],
    }).onDelete("cascade"),
  ],
);
export const workspaceReports = pgTable(
  "workspace_reports",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    period: text("period").notNull(),
    startDay: date("start_day").notNull(),
    endDay: date("end_day").notNull(),
    content: jsonb("content").$type<Record<string, unknown>[]>().notNull(),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("workspace_report_daily_idx").on(
      t.workspaceId,
      t.period,
      t.endDay,
    ),
  ],
);
export const outboundWebhooks = pgTable(
  "outbound_webhooks",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    url: text("url").notNull(),
    secretCiphertext: text("secret_ciphertext").notNull(),
    events: jsonb("events").$type<string[]>().notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: created(),
  },
  (t) => [index("webhook_workspace_idx").on(t.workspaceId)],
);
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: id(),
    webhookId: uuid("webhook_id")
      .notNull()
      .references(() => outboundWebhooks.id, { onDelete: "cascade" }),
    eventKey: text("event_key").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").default("pending").notNull(),
    attempts: integer("attempts").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    lastStatus: integer("last_status"),
    lastError: text("last_error"),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("webhook_event_dedupe_idx").on(t.webhookId, t.eventKey),
    index("delivery_queue_idx").on(t.status, t.nextAttemptAt),
  ],
);

export const publicationJobs = pgTable(
  "publication_jobs",
  {
    id: id(),
    kind: text("kind").notNull(),
    radarId: uuid("radar_id").references(() => radars.id, {
      onDelete: "cascade",
    }),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    day: date("day").notNull(),
    cursor: uuid("cursor"),
    status: text("status").default("pending").notNull(),
    leaseToken: uuid("lease_token"),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
    lastError: text("last_error"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: created(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("publication_radar_day_idx").on(t.radarId, t.day),
    uniqueIndex("publication_workspace_day_idx").on(t.workspaceId, t.day),
    index("publication_queue_idx").on(t.status, t.updatedAt),
  ],
);
export const pipelineCursors = pgTable("pipeline_cursors", {
  id: text("id").primaryKey(),
  cursor: uuid("cursor"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const maintenanceRuns = pgTable("maintenance_runs", {
  id: uuid("id").primaryKey(),
  result: jsonb("result").$type<Record<string, unknown>>().notNull(),
  createdAt: created(),
});
