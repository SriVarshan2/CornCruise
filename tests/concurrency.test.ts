import { describe, it, expect } from 'vitest';
import { sql, eq } from 'drizzle-orm';
import { db } from '../src/db';
import { users, organizations, organizationMembers, projects, queues, jobs, workers } from '../src/db/schema';

describe('Database SKIP LOCKED Concurrency Integration Test', () => {
  it('should prove that concurrent workers cannot claim the same job', async () => {

    const timestamp = Date.now();

    // 1. Setup tenant context and queue
    const [user] = await db.insert(users).values({
      email: `concur_user_${timestamp}@test.com`,
      passwordHash: 'dummyhash',
      name: 'Concurrent Test User',
    }).returning();

    const [org] = await db.insert(organizations).values({
      name: `Concur Org ${timestamp}`,
    }).returning();

    await db.insert(organizationMembers).values({
      orgId: org.id,
      userId: user.id,
      role: 'owner',
    });

    const [project] = await db.insert(projects).values({
      orgId: org.id,
      name: `Concur Project ${timestamp}`,
    }).returning();

    const [queue] = await db.insert(queues).values({
      projectId: project.id,
      name: `concur-queue-${timestamp}`,
      priority: 10,
      concurrencyLimit: 10,
      maxRetries: 3,
    }).returning();

    // 2. Insert 5 queued jobs
    const seededJobs = await db.insert(jobs).values([
      { queueId: queue.id, payload: { task: 1 }, status: 'QUEUED', scheduledFor: new Date() },
      { queueId: queue.id, payload: { task: 2 }, status: 'QUEUED', scheduledFor: new Date() },
      { queueId: queue.id, payload: { task: 3 }, status: 'QUEUED', scheduledFor: new Date() },
      { queueId: queue.id, payload: { task: 4 }, status: 'QUEUED', scheduledFor: new Date() },
      { queueId: queue.id, payload: { task: 5 }, status: 'QUEUED', scheduledFor: new Date() },
    ]).returning();

    // 3. Register two concurrent workers
    const [workerA] = await db.insert(workers).values({
      instanceId: `worker-a-${timestamp}`,
      lastHeartbeatAt: new Date(),
    }).returning();

    const [workerB] = await db.insert(workers).values({
      instanceId: `worker-b-${timestamp}`,
      lastHeartbeatAt: new Date(),
    }).returning();

    // 4. Helper to trigger the atomic claim query (simulating simultaneous sweeps)
    const runClaimQuery = async (workerId: number) => {
      const result = await db.execute(sql`
        WITH claimable AS (
          SELECT j.id
          FROM jobs j
          JOIN queues q ON q.id = j.queue_id
          WHERE q.is_paused = false
            AND j.queue_id = ${queue.id}
            AND (
              (j.status = 'QUEUED' AND j.scheduled_for <= now())
              OR (j.status = 'RUNNING' AND j.locked_at < now() - interval '5 minutes')
            )
          ORDER BY q.priority DESC, j.scheduled_for ASC
          LIMIT 10
          FOR UPDATE OF j SKIP LOCKED
        )
        UPDATE jobs j
        SET status = 'RUNNING',
            locked_at = now(),
            locked_by_worker_id = ${workerId},
            attempts = j.attempts + 1,
            updated_at = now()
        FROM claimable
        WHERE j.id = claimable.id
        RETURNING j.id;
      `);
      return result.rows.map((row: any) => row.id as number);
    };

    // 5. Fire off concurrent claims in parallel using Promise.all
    const [claimedByA, claimedByB] = await Promise.all([
      runClaimQuery(workerA.id),
      runClaimQuery(workerB.id),
    ]);

    console.log('Worker A claimed job IDs:', claimedByA);
    console.log('Worker B claimed job IDs:', claimedByB);

    // 6. Assertions:
    // - Every claimed job must belong to the seeded job set
    const seededIds = seededJobs.map(j => j.id);
    claimedByA.forEach(id => expect(seededIds).toContain(id));
    claimedByB.forEach(id => expect(seededIds).toContain(id));

    // - Worker A and Worker B must never claim the same job ID (SKIP LOCKED guarantee)
    const overlaps = claimedByA.filter(id => claimedByB.includes(id));
    expect(overlaps).toEqual([]);

    // - The total number of claimed jobs must match our total seeded jobs (5)
    expect(claimedByA.length + claimedByB.length).toBe(5);

    // - Verify in the database that each claimed job's locked_by_worker_id matches the respective claiming worker
    for (const jobId of claimedByA) {
      const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
      expect(job.status).toBe('RUNNING');
      expect(job.lockedByWorkerId).toBe(workerA.id);
    }

    for (const jobId of claimedByB) {
      const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
      expect(job.status).toBe('RUNNING');
      expect(job.lockedByWorkerId).toBe(workerB.id);
    }
  }, 30000);
});
