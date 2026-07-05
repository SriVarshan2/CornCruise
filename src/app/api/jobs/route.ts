import { NextResponse } from 'next/server';
import { db } from '@/db';
import { queues, jobs } from '@/db/schema';
import { checkTenantAccess } from '@/lib/tenant';
import { eq, and, sql } from 'drizzle-orm';
import parser from 'cron-parser';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const queueIdStr = searchParams.get('queueId');

    if (!queueIdStr) {
      return NextResponse.json({ error: 'queueId query parameter is required' }, { status: 400 });
    }
    const queueId = parseInt(queueIdStr, 10);
    if (isNaN(queueId)) {
      return NextResponse.json({ error: 'Invalid queueId format' }, { status: 400 });
    }

    // Verify tenant access for the queue
    const access = await checkTenantAccess(request, { type: 'queue', id: queueId });
    if (!access.success) {
      return NextResponse.json({ error: access.error }, { status: access.error?.includes('Unauthorized') ? 401 : 403 });
    }

    // Query parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    if (isNaN(page) || page < 1 || isNaN(pageSize) || pageSize < 1) {
      return NextResponse.json({ error: 'Invalid page or pageSize parameters' }, { status: 400 });
    }

    const statusFilter = searchParams.get('status');
    const validStatuses = ['QUEUED', 'SCHEDULED', 'RUNNING', 'COMPLETED', 'FAILED'];
    if (statusFilter && !validStatuses.includes(statusFilter)) {
      return NextResponse.json({ error: 'Invalid status parameter' }, { status: 400 });
    }

    const offset = (page - 1) * pageSize;

    // Build query conditions
    const conditions = [eq(jobs.queueId, queueId)];
    if (statusFilter) {
      conditions.push(eq(jobs.status, statusFilter as any));
    }

    const whereClause = and(...conditions);

    const queueJobs = await db
      .select()
      .from(jobs)
      .where(whereClause)
      .limit(pageSize)
      .offset(offset)
      .orderBy(jobs.id);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobs)
      .where(whereClause);

    return NextResponse.json({
      data: queueJobs,
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
    const { queueId, type, payload, delaySeconds, cronExpression, payloads } = body;

    // Validate queueId
    if (!queueId) {
      return NextResponse.json({ error: 'queueId is required' }, { status: 400 });
    }
    const parsedQueueId = parseInt(queueId, 10);
    if (isNaN(parsedQueueId)) {
      return NextResponse.json({ error: 'Invalid queueId format' }, { status: 400 });
    }

    // Verify tenant access for the queue
    const access = await checkTenantAccess(request, { type: 'queue', id: parsedQueueId });
    if (!access.success) {
      return NextResponse.json({ error: access.error }, { status: access.error?.includes('Unauthorized') ? 401 : 403 });
    }

    // Verify queue existence
    const [queue] = await db
      .select()
      .from(queues)
      .where(eq(queues.id, parsedQueueId))
      .limit(1);

    if (!queue) {
      return NextResponse.json({ error: 'Queue not found' }, { status: 404 });
    }

    // Validate type
    if (!type || !['immediate', 'delayed', 'recurring', 'batch'].includes(type)) {
      return NextResponse.json({ error: 'type must be one of: immediate, delayed, recurring, batch' }, { status: 400 });
    }

    // Process ingestion based on type
    if (type === 'immediate') {
      if (payload === undefined || payload === null) {
        return NextResponse.json({ error: 'payload is required for immediate jobs' }, { status: 400 });
      }

      const [newJob] = await db
        .insert(jobs)
        .values({
          queueId: parsedQueueId,
          status: 'QUEUED',
          payload,
          scheduledFor: new Date(),
          attempts: 0
        })
        .returning();

      return NextResponse.json(newJob, { status: 201 });
    }

    if (type === 'delayed') {
      if (payload === undefined || payload === null) {
        return NextResponse.json({ error: 'payload is required for delayed jobs' }, { status: 400 });
      }
      if (delaySeconds === undefined || typeof delaySeconds !== 'number' || delaySeconds <= 0) {
        return NextResponse.json({ error: 'delaySeconds must be a positive number' }, { status: 400 });
      }

      const scheduledFor = new Date(Date.now() + delaySeconds * 1000);
      const [newJob] = await db
        .insert(jobs)
        .values({
          queueId: parsedQueueId,
          status: 'QUEUED',
          payload,
          scheduledFor,
          attempts: 0
        })
        .returning();

      return NextResponse.json(newJob, { status: 201 });
    }

    if (type === 'recurring') {
      if (payload === undefined || payload === null) {
        return NextResponse.json({ error: 'payload is required for recurring jobs' }, { status: 400 });
      }
      if (!cronExpression || typeof cronExpression !== 'string') {
        return NextResponse.json({ error: 'cronExpression is required for recurring jobs' }, { status: 400 });
      }

      try {
        parser.parse(cronExpression);
      } catch (e) {
        return NextResponse.json({ error: 'Invalid cronExpression format' }, { status: 400 });
      }

      const [newJob] = await db
        .insert(jobs)
        .values({
          queueId: parsedQueueId,
          status: 'QUEUED', // ready for the first run immediately
          payload,
          scheduledFor: new Date(),
          cronExpression,
          attempts: 0
        })
        .returning();

      return NextResponse.json(newJob, { status: 201 });
    }

    if (type === 'batch') {
      if (!payloads || !Array.isArray(payloads) || payloads.length === 0) {
        return NextResponse.json({ error: 'payloads must be a non-empty array for batch jobs' }, { status: 400 });
      }

      // Create parent job
      const [parentJob] = await db
        .insert(jobs)
        .values({
          queueId: parsedQueueId,
          status: 'SCHEDULED', // parents remain SCHEDULED until children are completed
          payload: { batch: true },
          scheduledFor: new Date(),
          attempts: 0
        })
        .returning();

      // Create child jobs sequentially using standard queries
      const childJobs = [];
      for (const itemPayload of payloads) {
        const [childJob] = await db
          .insert(jobs)
          .values({
            queueId: parsedQueueId,
            parentJobId: parentJob.id,
            status: 'QUEUED',
            payload: itemPayload,
            scheduledFor: new Date(),
            attempts: 0
          })
          .returning();
        childJobs.push(childJob);
      }

      return NextResponse.json({ parent: parentJob, children: childJobs }, { status: 201 });
    }

    return NextResponse.json({ error: 'Invalid job configuration' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
