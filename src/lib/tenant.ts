import { db } from '@/db';
import { organizationMembers, projects, queues, jobs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyJWT } from './auth';

export interface AuthContext {
  userId: number;
  email: string;
}

export type ResourceDescriptor =
  | { type: 'org'; id: number }
  | { type: 'project'; id: number }
  | { type: 'queue'; id: number }
  | { type: 'job'; id: number };

/**
 * Reusable tenant isolation function.
 * 1. Verifies the user's JWT from the Authorization header.
 * 2. Cascades checks up the entity tree to verify if the user is a member
 *    of the organization that owns the requested resource.
 */
export async function checkTenantAccess(
  authHeader: string | null,
  resource: ResourceDescriptor
): Promise<{ success: boolean; context?: AuthContext; error?: string }> {
  // 1. Verify JWT presence & validity
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false, error: 'Unauthorized: Missing or invalid token' };
  }
  
  const token = authHeader.substring(7);
  const payload = await verifyJWT(token);
  if (!payload) {
    return { success: false, error: 'Unauthorized: Session expired or invalid' };
  }

  const userId = payload.userId;

  try {
    let orgId: number;

    // 2. Resolve organization ID from resource mapping
    if (resource.type === 'org') {
      orgId = resource.id;
    } else if (resource.type === 'project') {
      const [proj] = await db
        .select({ orgId: projects.orgId })
        .from(projects)
        .where(eq(projects.id, resource.id))
        .limit(1);

      if (!proj) {
        return { success: false, error: 'Project not found' };
      }
      orgId = proj.orgId;
    } else if (resource.type === 'queue') {
      const [queueData] = await db
        .select({ orgId: projects.orgId })
        .from(queues)
        .innerJoin(projects, eq(queues.projectId, projects.id))
        .where(eq(queues.id, resource.id))
        .limit(1);

      if (!queueData) {
        return { success: false, error: 'Queue not found' };
      }
      orgId = queueData.orgId;
    } else if (resource.type === 'job') {
      const [jobData] = await db
        .select({ orgId: projects.orgId })
        .from(jobs)
        .innerJoin(queues, eq(jobs.queueId, queues.id))
        .innerJoin(projects, eq(queues.projectId, projects.id))
        .where(eq(jobs.id, resource.id))
        .limit(1);

      if (!jobData) {
        return { success: false, error: 'Job not found' };
      }
      orgId = jobData.orgId;
    } else {
      return { success: false, error: 'Invalid resource type' };
    }

    // 3. Verify user membership in the organization Members table
    const [membership] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.orgId, orgId)
        )
      )
      .limit(1);

    if (!membership) {
      return { success: false, error: 'Forbidden: You do not have access to this organization\'s resources' };
    }

    return {
      success: true,
      context: {
        userId,
        email: payload.email
      }
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Tenant verification failed'
    };
  }
}
