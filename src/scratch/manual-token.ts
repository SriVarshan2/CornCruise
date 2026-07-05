import { db } from '../db';
import { jobs } from '../db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  const [job] = await db.select({
    id: jobs.id,
    status: jobs.status,
    attempts: jobs.attempts,
    scheduledFor: jobs.scheduledFor,
    cronExpression: jobs.cronExpression,
    lockedAt: jobs.lockedAt,
    updatedAt: jobs.updatedAt,
  }).from(jobs).where(eq(jobs.id, 14));
  
  console.log("=== JOB 14 DB STATE ===");
  console.log(JSON.stringify(job, null, 2));
  
  const nowIso = new Date().toISOString();
  const scheduledTs = new Date(job.scheduledFor).getTime();
  const nowTs = Date.now();
  console.log(`\nNow:         ${nowIso}`);
  console.log(`scheduledFor: ${job.scheduledFor}`);
  console.log(`scheduledFor is ${scheduledTs > nowTs ? 'IN THE FUTURE ✅' : 'IN THE PAST ❌'}`);
}

main().catch(console.error);
