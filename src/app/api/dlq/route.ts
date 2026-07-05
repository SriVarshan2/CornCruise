import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deadLetterQueue, queues, projects } from '@/db/schema';
import { checkTenantAccess } from '@/lib/tenant';
import { eq, and, sql, inArray } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectIdStr = searchParams.get('projectId');
    const queueIdStr = searchParams.get('queueId');

    if (!projectIdStr) {
      return NextResponse.json({ error: 'projectId query parameter is required' }, { status: 400 });
    }
    const projectId = parseInt(projectIdStr, 10);
    if (isNaN(projectId)) {
      return NextResponse.json({ error: 'Invalid projectId format' }, { status: 400 });
    }

    // Verify tenant access for the project
    const access = await checkTenantAccess(request, { type: 'project', id: projectId });
    if (!access.success) {
      return NextResponse.json(
        { error: access.error },
        { status: access.error?.includes('Unauthorized') ? 401 : 403 }
      );
    }

    // Pagination
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
    if (isNaN(page) || page < 1 || isNaN(pageSize) || pageSize < 1) {
      return NextResponse.json({ error: 'Invalid page or pageSize parameters' }, { status: 400 });
    }
    const offset = (page - 1) * pageSize;

    // Get all queue IDs for this project
    const projectQueues = await db
      .select({ id: queues.id })
      .from(queues)
      .where(eq(queues.projectId, projectId));

    const queueIds = projectQueues.map((q) => q.id);

    if (queueIds.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: { page, pageSize, totalItems: 0, totalPages: 0 },
      });
    }

    // Build conditions
    let whereClause;
    if (queueIdStr) {
      const queueId = parseInt(queueIdStr, 10);
      if (isNaN(queueId)) {
        return NextResponse.json({ error: 'Invalid queueId format' }, { status: 400 });
      }
      if (!queueIds.includes(queueId)) {
        return NextResponse.json({ error: 'Queue not found in this project' }, { status: 404 });
      }
      whereClause = eq(deadLetterQueue.queueId, queueId);
    } else {
      whereClause = inArray(deadLetterQueue.queueId, queueIds);
    }

    // Fetch DLQ entries
    const entries = await db
      .select()
      .from(deadLetterQueue)
      .where(whereClause)
      .limit(pageSize)
      .offset(offset)
      .orderBy(deadLetterQueue.movedAt);

    // Count
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(deadLetterQueue)
      .where(whereClause);

    return NextResponse.json({
      data: entries,
      pagination: {
        page,
        pageSize,
        totalItems: countResult?.count || 0,
        totalPages: Math.ceil((countResult?.count || 0) / pageSize),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
