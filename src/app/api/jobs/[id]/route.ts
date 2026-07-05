import { NextResponse } from 'next/server';
import { db } from '@/db';
import { jobs, jobExecutions } from '@/db/schema';
import { checkTenantAccess } from '@/lib/tenant';
import { eq } from 'drizzle-orm';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Resolve dynamic path parameter
    const resolvedParams = await params;
    const jobId = parseInt(resolvedParams.id, 10);

    if (isNaN(jobId)) {
      return NextResponse.json({ error: 'Invalid job ID format' }, { status: 400 });
    }

    // Verify tenant access for the job
    const access = await checkTenantAccess(request, { type: 'job', id: jobId });
    if (!access.success) {
      return NextResponse.json({ error: access.error }, { status: access.error?.includes('Unauthorized') ? 401 : 403 });
    }

    // Fetch the job
    const [job] = await db
      .select()
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1);

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Fetch its executions
    const executions = await db
      .select()
      .from(jobExecutions)
      .where(eq(jobExecutions.jobId, jobId));

    // If it is a batch parent job, fetch its children and their status
    let children: any[] = [];
    let batchStatus: string | undefined = undefined;
    if (job.payload && typeof job.payload === 'object' && (job.payload as any).batch === true) {
      children = await db
        .select({
          id: jobs.id,
          status: jobs.status,
          attempts: jobs.attempts,
          createdAt: jobs.createdAt,
          updatedAt: jobs.updatedAt
        })
        .from(jobs)
        .where(eq(jobs.parentJobId, jobId));

      if (children.length > 0) {
        const allCompleted = children.every(child => child.status === 'COMPLETED');
        const allTerminal = children.every(child => child.status === 'COMPLETED' || child.status === 'FAILED');
        const hasFailed = children.some(child => child.status === 'FAILED');

        if (allCompleted) {
          batchStatus = 'COMPLETED';
        } else if (allTerminal && hasFailed) {
          batchStatus = 'FAILED';
        } else {
          batchStatus = 'IN_PROGRESS';
        }
      }
    }

    return NextResponse.json({
      ...job,
      executions,
      children,
      ...(batchStatus !== undefined ? { batchStatus } : {})
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
