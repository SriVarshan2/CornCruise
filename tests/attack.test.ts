import { describe, it, expect } from 'vitest';
import { db } from '../src/db';
import { users, organizations, organizationMembers, projects, queues, deadLetterQueue } from '../src/db/schema';
import { signJWT } from '../src/lib/auth';
import { eq } from 'drizzle-orm';

describe('DLQ Tenant Isolation Integration Test', () => {
  it('should prevent an attacker from viewing a victim project\'s DLQ entries', async () => {
    // 1. Create clean unique test users
    const timestamp = Date.now();
    const victimEmail = `victim_${timestamp}@test.com`;
    const attackerEmail = `attacker_${timestamp}@test.com`;

    const [victimUser] = await db.insert(users).values({
      email: victimEmail,
      passwordHash: 'dummyhash',
      name: 'Victim User',
    }).returning();

    const [attackerUser] = await db.insert(users).values({
      email: attackerEmail,
      passwordHash: 'dummyhash',
      name: 'Attacker User',
    }).returning();

    // 2. Create distinct organizations
    const [victimOrg] = await db.insert(organizations).values({
      name: `Victim Org ${timestamp}`,
    }).returning();

    const [attackerOrg] = await db.insert(organizations).values({
      name: `Attacker Org ${timestamp}`,
    }).returning();

    // 3. Map organization members
    await db.insert(organizationMembers).values([
      { orgId: victimOrg.id, userId: victimUser.id, role: 'owner' },
      { orgId: attackerOrg.id, userId: attackerUser.id, role: 'owner' },
    ]);

    // 4. Create projects
    const [victimProject] = await db.insert(projects).values({
      orgId: victimOrg.id,
      name: `Victim Project ${timestamp}`,
    }).returning();

    const [attackerProject] = await db.insert(projects).values({
      orgId: attackerOrg.id,
      name: `Attacker Project ${timestamp}`,
    }).returning();

    // 5. Create a queue and a DLQ entry for the victim
    const [victimQueue] = await db.insert(queues).values({
      projectId: victimProject.id,
      name: `victim-queue-${timestamp}`,
      priority: 1,
      concurrencyLimit: 5,
      maxRetries: 3,
    }).returning();

    await db.insert(deadLetterQueue).values({
      jobId: 99999,
      queueId: victimQueue.id,
      originalPayload: { secret: 'victim-data' },
      failureReason: 'Connection timeout',
      attemptsMade: 3,
    });

    // 6. Generate JWTs for both users
    const victimToken = await signJWT({ userId: victimUser.id, email: victimUser.email });
    const attackerToken = await signJWT({ userId: attackerUser.id, email: attackerUser.email });

    // 7. Perform the attack request (Attacker tries to query Victim's projectId)
    const attackUrl = `http://localhost:3000/api/dlq?projectId=${victimProject.id}`;
    const attackRes = await fetch(attackUrl, {
      headers: {
        'Authorization': `Bearer ${attackerToken}`,
      },
    });

    const attackData = await attackRes.json();
    console.log('Attacker response status:', attackRes.status);
    console.log('Attacker response body:', attackData);

    // Expect 403 Forbidden (checkTenantAccess returns failure, endpoint maps to 403)
    expect(attackRes.status).toBe(403);
    expect(attackData.error).toContain('Forbidden');

    // 8. Perform a legitimate query (Victim queries own projectId)
    const legitRes = await fetch(attackUrl, {
      headers: {
        'Authorization': `Bearer ${victimToken}`,
      },
    });

    const legitData = await legitRes.json();
    console.log('Victim response status:', legitRes.status);
    console.log('Victim response body data length:', legitData.data?.length);

    // Expect 200 OK and data to contain the DLQ entry
    expect(legitRes.status).toBe(200);
    expect(legitData.data).toBeDefined();
    expect(legitData.data.length).toBeGreaterThan(0);
    expect(legitData.data[0].failureReason).toBe('Connection timeout');

    // Cleanup test data
    await db.delete(deadLetterQueue).where(eq(deadLetterQueue.queueId, victimQueue.id));
    await db.delete(queues).where(eq(queues.id, victimQueue.id));
    await db.delete(projects).where(eq(projects.id, victimProject.id));
    await db.delete(projects).where(eq(projects.id, attackerProject.id));
    await db.delete(organizationMembers).where(eq(organizationMembers.userId, victimUser.id));
    await db.delete(organizationMembers).where(eq(organizationMembers.userId, attackerUser.id));
    await db.delete(organizations).where(eq(organizations.id, victimOrg.id));
    await db.delete(organizations).where(eq(organizations.id, attackerOrg.id));
    await db.delete(users).where(eq(users.id, victimUser.id));
    await db.delete(users).where(eq(users.id, attackerUser.id));
  }, 30000);
});
