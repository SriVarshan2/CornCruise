import { NextResponse } from 'next/server';
import { sql, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { jobs, queues, retryPolicies, workers, jobExecutions, deadLetterQueue } from '@/db/schema';
import parser from 'cron-parser';

export const maxDuration = 60; // Vercel Pro plan default — matches vercel.json if you raise it
export const dynamic = 'force-dynamic';

// --- Tunables ---
const SAFETY_MARGIN_MS = 10_000;      // stop claiming new work this many ms before maxDuration
const CLAIM_BATCH_SIZE = 20;          // max jobs claimed in one sweep, across all queues
const STALE_LOCK_MINUTES = 5;
const MOCK_SUCCESS_RATE = 0.7;        // placeholder — replace with real job execution later
const DEFAULT_RETRY_BASE_MS = 5000;   // fallback if queue has no retryPolicy attached

export async function GET(request: Request) {
  const startedAt = Date.now();
  const hardLimitMs = maxDuration * 1000;

  // --- Auth: CRON_SECRET check, first, before anything else ---
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // --- Heartbeat: upsert this invocation as a worker row ---
  const instanceId = request.headers.get('x-vercel-id') || `local-${crypto.randomUUID()}`;
  const [worker] = await db
    .insert(workers)
    .values({ instanceId, lastHeartbeatAt: new Date() })
    .onConflictDoUpdate({
      target: workers.instanceId,
      set: { lastHeartbeatAt: new Date() },
    })
    .returning();

  const summary = {
    workerId: worker.id,
    claimed: 0,
    completed: 0,
    retried: 0,
    deadLettered: 0,
    recurringRescheduled: 0,
    stoppedEarly: false,
  };

  // --- Stop claiming NEW jobs once we're within SAFETY_MARGIN_MS of maxDuration ---
  const elapsed = () => Date.now() - startedAt;
  if (elapsed() > hardLimitMs - SAFETY_MARGIN_MS) {
    summary.stoppedEarly = true;
    return NextResponse.json(summary);
  }

  // --- Atomic claim: single statement, no transaction needed ---
  // Respects: is_paused, priority DESC / scheduled_for ASC ordering,
  // per-queue concurrency_limit (via correlated subquery), and 5-min stale-lock reclaim.
  const claimResult = await db.execute(sql`
    WITH claimable AS (
      SELECT j.id
      FROM jobs j
      JOIN queues q ON q.id = j.queue_id
      WHERE q.is_paused = false
        AND (
          (j.status = 'QUEUED' AND j.scheduled_for <= now())
          OR (j.status = 'RUNNING' AND j.locked_at < now() - interval '5 minutes')
        )
        AND (
          SELECT count(*)::int FROM jobs j2
          WHERE j2.queue_id = j.queue_id
            AND j2.status = 'RUNNING'
            AND j2.locked_at >= now() - interval '5 minutes'
            AND j2.id <> j.id
        ) < q.concurrency_limit
      ORDER BY q.priority DESC, j.scheduled_for ASC
      LIMIT ${CLAIM_BATCH_SIZE}
      FOR UPDATE OF j SKIP LOCKED
    )
    UPDATE jobs j
    SET status = 'RUNNING',
        locked_at = now(),
        locked_by_worker_id = ${worker.id},
        attempts = j.attempts + 1,
        updated_at = now()
    FROM claimable
    WHERE j.id = claimable.id
    RETURNING j.id, j.queue_id, j.parent_job_id, j.payload, j.attempts,
              j.cron_expression, j.scheduled_for;
  `);

  const claimedJobs = claimResult.rows as Array<{
    id: number; queue_id: number; parent_job_id: number | null;
    payload: any; attempts: number; cron_expression: string | null; scheduled_for: string;
  }>;
  summary.claimed = claimedJobs.length;

  if (claimedJobs.length === 0) {
    return NextResponse.json(summary);
  }

  // --- Fetch queue + retry policy info for all claimed jobs in one query ---
  const queueIds = [...new Set(claimedJobs.map(j => j.queue_id))];
  const queueInfoRows = await db
    .select({
      queueId: queues.id,
      maxRetries: queues.maxRetries,
      retryType: retryPolicies.type,
      baseDelayMs: retryPolicies.baseDelayMs,
      maxDelayMs: retryPolicies.maxDelayMs,
    })
    .from(queues)
    .leftJoin(retryPolicies, eq(queues.retryPolicyId, retryPolicies.id))
    .where(inArray(queues.id, queueIds));

  const queueInfoMap = new Map(queueInfoRows.map(q => [q.queueId, q]));

  // --- Process each claimed job, checking elapsed time each iteration ---
  // If we run out of time mid-loop, remaining claimed-but-unprocessed jobs stay
  // status='RUNNING' with a locked_at timestamp — the 5-min stale-lock reclaim
  // in the NEXT sweep will pick them back up. This is the deliberate, disclosed
  // at-least-once trade-off, not a bug.
  for (const job of claimedJobs) {
    if (elapsed() > hardLimitMs - SAFETY_MARGIN_MS) {
      summary.stoppedEarly = true;
      break;
    }

    const queueInfo = queueInfoMap.get(job.queue_id);
    const maxRetries = queueInfo?.maxRetries ?? 3;

    const [execution] = await db
      .insert(jobExecutions)
      .values({ jobId: job.id, workerId: worker.id, status: 'RUNNING', startedAt: new Date() })
      .returning();

    // --- Mock execution: placeholder for real job code ---
    const succeeded = Math.random() < MOCK_SUCCESS_RATE;

    if (succeeded) {
      if (job.cron_expression) {
        // Recurring job: reschedule, never mark COMPLETED (that would end recurrence)
        const next = parser.parse(job.cron_expression, { currentDate: new Date() }).next().toDate();
        console.log(`[CRON][job=${job.id}] BEFORE reschedule UPDATE: attempts-from-claim=${job.attempts}, writing attempts=0, scheduledFor=${next.toISOString()}`);
        const rescheduleResult = await db.update(jobs).set({
          status: 'QUEUED',
          scheduledFor: next,
          attempts: 0,
          lockedAt: null,
          lockedByWorkerId: null,
          updatedAt: new Date(),
        }).where(eq(jobs.id, job.id)).returning();
        console.log(`[CRON][job=${job.id}] AFTER reschedule UPDATE returning:`, JSON.stringify(rescheduleResult));
        summary.recurringRescheduled++;
      } else {
        await db.update(jobs).set({
          status: 'COMPLETED',
          lockedAt: null,
          lockedByWorkerId: null,
          updatedAt: new Date(),
        }).where(eq(jobs.id, job.id));
        summary.completed++;
      }
      await db.update(jobExecutions).set({
        status: 'COMPLETED',
        completedAt: new Date(),
      }).where(eq(jobExecutions.id, execution.id));

    } else {
      if (job.attempts >= maxRetries) {
        // Retry exhaustion → Dead Letter Queue
        await db.insert(deadLetterQueue).values({
          jobId: job.id,
          queueId: job.queue_id,
          originalPayload: job.payload,
          failureReason: 'Mock execution failure (simulated) — retries exhausted',
          attemptsMade: job.attempts,
          movedAt: new Date(),
        });
        await db.update(jobs).set({
          status: 'FAILED',
          lockedAt: null,
          lockedByWorkerId: null,
          updatedAt: new Date(),
        }).where(eq(jobs.id, job.id));
        summary.deadLettered++;
      } else {
        // Compute backoff delay by policy type
        const type = queueInfo?.retryType ?? 'FIXED';
        const base = queueInfo?.baseDelayMs ?? DEFAULT_RETRY_BASE_MS;
        const cap = queueInfo?.maxDelayMs ?? null;

        let delayMs: number;
        if (type === 'LINEAR') delayMs = base * job.attempts;
        else if (type === 'EXPONENTIAL') delayMs = base * Math.pow(2, job.attempts - 1);
        else delayMs = base; // FIXED

        if (cap !== null) delayMs = Math.min(delayMs, cap);

        await db.update(jobs).set({
          status: 'QUEUED',
          scheduledFor: new Date(Date.now() + delayMs),
          lockedAt: null,
          lockedByWorkerId: null,
          updatedAt: new Date(),
        }).where(eq(jobs.id, job.id));
        summary.retried++;
      }
      await db.update(jobExecutions).set({
        status: 'FAILED',
        errorLog: 'Mock execution failure (simulated)',
        completedAt: new Date(),
      }).where(eq(jobExecutions.id, execution.id));
    }
  }

  return NextResponse.json(summary);
}
