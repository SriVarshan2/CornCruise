import { NextResponse } from 'next/server';
import { db } from '@/db';
import { queues, retryPolicies } from '@/db/schema';
import { checkTenantAccess } from '@/lib/tenant';
import { eq, and, sql } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectIdStr = searchParams.get('projectId');

    if (!projectIdStr) {
      return NextResponse.json({ error: 'projectId query parameter is required' }, { status: 400 });
    }
    const projectId = parseInt(projectIdStr, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid projectId format' }, { status: 400 });
    }

    // Verify tenant access
    const access = await checkTenantAccess(request, { type: 'project', id: projectId });
    if (!access.success) {
      return NextResponse.json({ error: access.error }, { status: access.error?.includes('Unauthorized') ? 401 : 403 });
    }

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    if (isNaN(page) || page < 1 || isNaN(pageSize) || pageSize < 1) {
      return NextResponse.json({ error: 'Invalid page or pageSize parameters' }, { status: 400 });
    }
    const offset = (page - 1) * pageSize;

    const projectQueues = await db
      .select()
      .from(queues)
      .where(eq(queues.projectId, projectId))
      .limit(pageSize)
      .offset(offset)
      .orderBy(queues.priority, queues.name);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(queues)
      .where(eq(queues.projectId, projectId));

    return NextResponse.json({
      data: projectQueues,
      pagination: {
        page,
        pageSize,
        totalItems: countResult?.count || 0,
        totalPages: Math.ceil((countResult?.count || 0) / pageSize)
      }
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectId, name, priority, concurrencyLimit, maxRetries, retryPolicyId } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Queue name is required' }, { status: 400 });
    }

    const parsedProjectId = parseInt(projectId, 10);
    if (isNaN(parsedProjectId)) {
      return NextResponse.json({ error: 'Invalid projectId format' }, { status: 400 });
    }

    // Verify tenant access
    const access = await checkTenantAccess(request, { type: 'project', id: parsedProjectId });
    if (!access.success) {
      return NextResponse.json({ error: access.error }, { status: access.error?.includes('Unauthorized') ? 401 : 403 });
    }

    // Validate retry policy if provided
    let validatedRetryPolicyId: number | null = null;
    if (retryPolicyId !== undefined && retryPolicyId !== null) {
      const parsedPolicyId = parseInt(retryPolicyId, 10);
      if (isNaN(parsedPolicyId)) {
        return NextResponse.json({ error: 'Invalid retryPolicyId format' }, { status: 400 });
      }
      
      const [policy] = await db
        .select()
        .from(retryPolicies)
        .where(eq(retryPolicies.id, parsedPolicyId))
        .limit(1);

      if (!policy) {
        return NextResponse.json({ error: 'Retry policy not found' }, { status: 400 });
      }
      validatedRetryPolicyId = parsedPolicyId;
    }

    const [newQueue] = await db
      .insert(queues)
      .values({
        projectId: parsedProjectId,
        name,
        priority: priority !== undefined ? parseInt(priority, 10) : 0,
        concurrencyLimit: concurrencyLimit !== undefined ? parseInt(concurrencyLimit, 10) : 10,
        maxRetries: maxRetries !== undefined ? parseInt(maxRetries, 10) : 3,
        retryPolicyId: validatedRetryPolicyId,
        isPaused: false
      })
      .returning();

    return NextResponse.json(newQueue, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
