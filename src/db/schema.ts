import { pgTable, serial, text, integer, boolean, timestamp, uniqueIndex, index, pgEnum, jsonb, varchar, foreignKey } from 'drizzle-orm/pg-core';

// Enums
export const jobStatusEnum = pgEnum('job_status', ['QUEUED', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED']);
export const retryTypeEnum = pgEnum('retry_type', ['FIXED', 'LINEAR', 'EXPONENTIAL']);
export const orgRoleEnum = pgEnum('org_role', ['owner', 'admin', 'member']);

// users
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// organizations
export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// organizationMembers
export const organizationMembers = pgTable('organizationMembers', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  role: orgRoleEnum('role').default('member').notNull()
}, (table) => {
  return {
    orgUserUniqueIdx: uniqueIndex('org_user_unique_idx').on(table.orgId, table.userId)
  };
});

// projects
export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// retryPolicies
export const retryPolicies = pgTable('retryPolicies', {
  id: serial('id').primaryKey(),
  orgId: integer('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  type: retryTypeEnum('type').notNull(),
  baseDelayMs: integer('base_delay_ms').notNull(),
  maxDelayMs: integer('max_delay_ms'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// queues
export const queues = pgTable('queues', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }).notNull(),
  retryPolicyId: integer('retry_policy_id').references(() => retryPolicies.id),
  name: text('name').notNull(),
  priority: integer('priority').default(0).notNull(),
  concurrencyLimit: integer('concurrency_limit').default(10).notNull(),
  maxRetries: integer('max_retries').default(3).notNull(),
  isPaused: boolean('is_paused').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// workers
export const workers = pgTable('workers', {
  id: serial('id').primaryKey(),
  instanceId: text('instance_id').unique().notNull(),
  lastHeartbeatAt: timestamp('last_heartbeat_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// jobs
export const jobs = pgTable('jobs', {
  id: serial('id').primaryKey(),
  queueId: integer('queue_id').references(() => queues.id, { onDelete: 'cascade' }).notNull(),
  parentJobId: integer('parent_job_id'), // Self-referencing FK defined in extra config below
  status: jobStatusEnum('status').default('QUEUED').notNull(),
  payload: jsonb('payload').notNull(),
  attempts: integer('attempts').default(0).notNull(),
  scheduledFor: timestamp('scheduled_for').defaultNow().notNull(),
  cronExpression: varchar('cron_expression', { length: 255 }),
  lockedAt: timestamp('locked_at'),
  lockedByWorkerId: integer('locked_by_worker_id').references(() => workers.id, { onDelete: 'set null' }),
  checkpointData: jsonb('checkpoint_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => {
  return {
    parentJobFk: foreignKey({
      columns: [table.parentJobId],
      foreignColumns: [table.id]
    }),
    compositeIdx: index('jobs_queue_status_sched_idx').on(table.queueId, table.status, table.scheduledFor),
    parentJobIdx: index('jobs_parent_job_idx').on(table.parentJobId)
  };
});

// jobExecutions
export const jobExecutions = pgTable('jobExecutions', {
  id: serial('id').primaryKey(),
  jobId: integer('job_id').references(() => jobs.id, { onDelete: 'cascade' }).notNull(),
  workerId: integer('worker_id').references(() => workers.id, { onDelete: 'set null' }),
  status: jobStatusEnum('status').notNull(),
  errorLog: text('error_log'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at')
});

// deadLetterQueue
export const deadLetterQueue = pgTable('deadLetterQueue', {
  id: serial('id').primaryKey(),
  jobId: integer('job_id').notNull(),
  queueId: integer('queue_id').notNull(),
  originalPayload: jsonb('original_payload').notNull(),
  failureReason: text('failure_reason').notNull(),
  attemptsMade: integer('attempts_made').notNull(),
  movedAt: timestamp('moved_at').defaultNow().notNull()
});
