import { describe, it, expect } from 'vitest';
import { db } from '../src/db';
import { users, organizations, organizationMembers, projects, queues, jobs, jobExecutions } from '../src/db/schema';
import { signJWT } from '../src/lib/auth';
import { eq } from 'drizzle-orm';

describe('Recurring Job Reschedule Runtime Test', () => {
  it('should create and successfully reschedule a recurring job', async () => {
    const timestamp = Date.now();
    
    // 1. Create a test queue
    const [user] = await db.insert(users).values({
      email: `user_${timestamp}@test.com`,
      passwordHash: 'dummyhash',
      name: 'Test User',
    }).returning();

    const [org] = await db.insert(organizations).values({
      name: `Org ${timestamp}`,
    }).returning();

    await db.insert(organizationMembers).values({
      orgId: org.id,
      userId: user.id,
      role: 'owner',
    });

    const [project] = await db.insert(projects).values({
      orgId: org.id,
      name: `Project ${timestamp}`,
    }).returning();

    const [queue] = await db.insert(queues).values({
      projectId: project.id,
      name: `queue-${timestamp}`,
      priority: 1,
      concurrencyLimit: 5,
      maxRetries: 3,
    }).returning();

    // 2. Generate User JWT Token for authentication
    const userToken = await signJWT({ userId: user.id, email: user.email });

    // 3. POST /api/jobs (Create a recurring job)
    const cronExpr = '*/10 * * * *'; // Run every 10 minutes
    const createUrl = 'http://localhost:3000/api/jobs';
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        queueId: queue.id,
        type: 'recurring',
        payload: { test: 'recurring-run' },
        cronExpression: cronExpr,
      }),
    });

    const jobData = await createRes.json();
    console.log('Created Job Response:', jobData);

    expect(createRes.status).toBe(201);
    expect(jobData.id).toBeDefined();
    expect(jobData.cronExpression).toBe(cronExpr);
    expect(jobData.status).toBe('QUEUED');

    // 4. Manually trigger the cron executor route in a loop until rescheduling succeeds
    const executeUrl = 'http://localhost:3000/api/cron/execute';
    const cronSecret = process.env.CRON_SECRET;
    
    let rescheduledSuccess = false;
    let attempts = 0;
    
    while (!rescheduledSuccess && attempts < 10) {
      attempts++;
      console.log(`Cron execution sweep attempt #${attempts}`);

      // Read the job's state BEFORE the sweep
      const [preJob] = await db.select().from(jobs).where(eq(jobs.id, jobData.id));
      console.log('Job state BEFORE sweep:', {
        id: preJob.id,
        status: preJob.status,
        attempts: preJob.attempts,
        scheduledFor: preJob.scheduledFor,
        lockedAt: preJob.lockedAt,
      });
      
      const execRes = await fetch(executeUrl, {
        headers: {
          'Authorization': `Bearer ${cronSecret}`,
        },
      });
      const execSummary = await execRes.json();
      console.log('Cron execute summary:', execSummary);

      // Check the job's state AFTER the sweep (immediately, before any further action)
      const [updatedJob] = await db.select().from(jobs).where(eq(jobs.id, jobData.id));
      console.log('Job state AFTER sweep:', {
        id: updatedJob.id,
        status: updatedJob.status,
        attempts: updatedJob.attempts,
        scheduledFor: updatedJob.scheduledFor,
      });

      // Check if OUR SPECIFIC JOB was actually rescheduled (not just any job in the sweep).
      // The global recurringRescheduled counter can fire for unrelated leftover jobs in the DB.
      const ourJobWasRescheduled =
        updatedJob.status === 'QUEUED' &&
        new Date(updatedJob.scheduledFor).getTime() > Date.now();

      if (ourJobWasRescheduled) {
        rescheduledSuccess = true;
        console.log(`OUR job ${jobData.id} was rescheduled. global recurringRescheduled=${execSummary.recurringRescheduled}`);
        
        // Confirm schedule updated correctly to the future next occurrence
        expect(updatedJob.status).toBe('QUEUED');
        // After a successful reschedule, the executor sets attempts=0.
        // If attempts is still 1 here, that means our job was NOT the one that was
        // rescheduled (a different recurring job was) and the counter was misleading.
        expect(updatedJob.attempts).toBe(0);
        expect(new Date(updatedJob.scheduledFor).getTime()).toBeGreaterThan(Date.now());
        break;
      } else {
        // Our specific job was not rescheduled yet — reset it so the next sweep can claim it
        console.log(`Job ${jobData.id} not rescheduled this sweep. Resetting for next attempt.`);
        await db.update(jobs).set({
          status: 'QUEUED',
          attempts: 0,
          scheduledFor: new Date(),
          lockedAt: null,
          lockedByWorkerId: null,
        }).where(eq(jobs.id, jobData.id));
      }
    }

    expect(rescheduledSuccess).toBe(true);

    // Cleanup database test data
    await db.delete(jobExecutions).where(eq(jobExecutions.jobId, jobData.id));
    await db.delete(jobs).where(eq(jobs.id, jobData.id));
    await db.delete(queues).where(eq(queues.id, queue.id));
    await db.delete(projects).where(eq(projects.id, project.id));
    await db.delete(organizationMembers).where(eq(organizationMembers.userId, user.id));
    await db.delete(organizations).where(eq(organizations.id, org.id));
    await db.delete(users).where(eq(users.id, user.id));
  }, 90000);
});
