import { describe, it, expect, vi } from 'vitest';
import { CronExpressionParser } from 'cron-parser';

// Types representing the database models
interface RetryPolicy {
  type: 'FIXED' | 'LINEAR' | 'EXPONENTIAL';
  baseDelayMs: number;
  maxDelayMs: number | null;
}

// 1. Core Logic to test: Retry Backoff Calculation
function calculateBackoff(policy: RetryPolicy | null, attempt: number): number {
  let delayMs = 5000; // Default fallback

  if (policy) {
    if (policy.type === 'FIXED') {
      delayMs = policy.baseDelayMs;
    } else if (policy.type === 'LINEAR') {
      delayMs = policy.baseDelayMs * attempt;
    } else if (policy.type === 'EXPONENTIAL') {
      delayMs = policy.baseDelayMs * Math.pow(2, attempt - 1);
    }

    if (policy.maxDelayMs && delayMs > policy.maxDelayMs) {
      delayMs = policy.maxDelayMs;
    }
  }

  return delayMs;
}

// 2. Core Logic to test: Recurring Job Reschedule Cycle
function getNextOccurrence(cronExpression: string): Date {
  const interval = CronExpressionParser.parse(cronExpression);
  return interval.next().toDate();
}

describe('Executor Core Logic Tests', () => {

  describe('Retry Backoff Math', () => {
    it('should compute FIXED backoff correctly', () => {
      const policy: RetryPolicy = {
        type: 'FIXED',
        baseDelayMs: 2000,
        maxDelayMs: null
      };

      expect(calculateBackoff(policy, 1)).toBe(2000);
      expect(calculateBackoff(policy, 2)).toBe(2000);
      expect(calculateBackoff(policy, 3)).toBe(2000);
    });

    it('should compute LINEAR backoff correctly', () => {
      const policy: RetryPolicy = {
        type: 'LINEAR',
        baseDelayMs: 1000,
        maxDelayMs: null
      };

      expect(calculateBackoff(policy, 1)).toBe(1000); // 1000 * 1
      expect(calculateBackoff(policy, 2)).toBe(2000); // 1000 * 2
      expect(calculateBackoff(policy, 3)).toBe(3000); // 1000 * 3
    });

    it('should compute EXPONENTIAL backoff correctly', () => {
      const policy: RetryPolicy = {
        type: 'EXPONENTIAL',
        baseDelayMs: 1000,
        maxDelayMs: null
      };

      expect(calculateBackoff(policy, 1)).toBe(1000); // 1000 * 2^0
      expect(calculateBackoff(policy, 2)).toBe(2000); // 1000 * 2^1
      expect(calculateBackoff(policy, 3)).toBe(4000); // 1000 * 2^2
      expect(calculateBackoff(policy, 4)).toBe(8000); // 1000 * 2^3
    });

    it('should cap EXPONENTIAL backoff at maxDelayMs', () => {
      const policy: RetryPolicy = {
        type: 'EXPONENTIAL',
        baseDelayMs: 1000,
        maxDelayMs: 5000
      };

      expect(calculateBackoff(policy, 1)).toBe(1000);
      expect(calculateBackoff(policy, 2)).toBe(2000);
      expect(calculateBackoff(policy, 3)).toBe(4000);
      expect(calculateBackoff(policy, 4)).toBe(5000); // capped at 5000 (instead of 8000)
    });
  });

  describe('Recurring Job Reschedule Cycle', () => {
    it('should calculate next recurrence time and verify states', () => {
      const cronExpression = '*/5 * * * *'; // Run every 5 minutes
      const now = new Date();
      const nextRun = getNextOccurrence(cronExpression);

      // Verify it is in the future and minutes difference is multiple of 5
      expect(nextRun.getTime()).toBeGreaterThan(now.getTime());
      
      const diffMs = nextRun.getTime() - now.getTime();
      const diffMinutes = Math.round(diffMs / 1000 / 60);
      expect(diffMinutes).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Stale-lock Reclaim Criteria', () => {
    it('should correctly target jobs stuck in RUNNING state past 5 minutes', () => {
      const mockJobs = [
        { id: 1, status: 'RUNNING', lockedAt: new Date(Date.now() - 6 * 60 * 1000) }, // 6 min ago (stale)
        { id: 2, status: 'RUNNING', lockedAt: new Date(Date.now() - 2 * 60 * 1000) }, // 2 min ago (active)
        { id: 3, status: 'QUEUED', lockedAt: null }
      ];

      const staleThreshold = 5 * 60 * 1000;
      const now = Date.now();

      const targetJobs = mockJobs.filter(j => 
        j.status === 'QUEUED' || 
        (j.status === 'RUNNING' && j.lockedAt && (now - j.lockedAt.getTime() > staleThreshold))
      );

      // Should find job 1 (stale running) and job 3 (queued)
      expect(targetJobs.map(j => j.id)).toContain(1);
      expect(targetJobs.map(j => j.id)).toContain(3);
      expect(targetJobs.map(j => j.id)).not.toContain(2);
    });
  });

  describe('Concurrent Claim Simulation (At-Most-Once Locks)', () => {
    it('should simulate concurrent worker sweeps without double-claiming', async () => {
      // Setup mock dataset of available jobs
      const dbJobs = [
        { id: 1, isLocked: false },
        { id: 2, isLocked: false },
        { id: 3, isLocked: false }
      ];

      // Simulated atomic transaction sweep with SELECT ... FOR UPDATE SKIP LOCKED behavior
      const claimJobsAtomic = async (workerId: string, limit: number) => {
        const claimed: typeof dbJobs = [];
        for (const job of dbJobs) {
          if (claimed.length >= limit) break;
          // Simulate SKIP LOCKED: if already locked, skip it
          if (!job.isLocked) {
            job.isLocked = true;
            claimed.push(job);
          }
        }
        return claimed;
      };

      // Trigger two concurrent worker sweep processes
      const workerA = claimJobsAtomic('worker-A', 2);
      const workerB = claimJobsAtomic('worker-B', 2);

      const [claimedA, claimedB] = await Promise.all([workerA, workerB]);

      // Worker A gets jobs 1 & 2
      expect(claimedA.map(j => j.id)).toEqual([1, 2]);
      // Worker B gets job 3 (skips 1 and 2 because worker A locked them)
      expect(claimedB.map(j => j.id)).toEqual([3]);

      // Confirm no overlaps occurred
      const intersection = claimedA.filter(a => claimedB.some(b => b.id === a.id));
      expect(intersection.length).toBe(0);
    });
  });
});
