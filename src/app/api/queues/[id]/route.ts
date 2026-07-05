import { NextResponse } from 'next/server';
import { db } from '@/db';
import { queues, retryPolicies } from '@/db/schema';
import { checkTenantAccess } from '@/lib/tenant';
import { eq } from 'drizzle-orm';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Resolve dynamic path parameter
    const resolvedParams = await params;
    const queueId = parseInt(resolvedParams.id, 10);

    if (isNaN(queueId)) {
      return NextResponse.json({ error: 'Invalid queue ID format' }, { status: 400 });
    }

    // Verify tenant access
    const access = await checkTenantAccess(request, { type: 'queue', id: queueId });
    if (!access.success) {
      return NextResponse.json({ error: access.error }, { status: access.error?.includes('Unauthorized') ? 401 : 403 });
    }

    const body = await request.json();
    const { priority, concurrencyLimit, maxRetries, isPaused, retryPolicyId } = body;

    // Build update parameters object dynamically
    const updateData: any = {};

    if (priority !== undefined) {
      const parsedPriority = parseInt(priority, 10);
      if (isNaN(parsedPriority)) {
        return NextResponse.json({ error: 'Invalid priority format' }, { status: 400 });
      }
      updateData.priority = parsedPriority;
    }

    if (concurrencyLimit !== undefined) {
      const parsedLimit = parseInt(concurrencyLimit, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        return NextResponse.json({ error: 'Invalid concurrencyLimit format or value' }, { status: 400 });
      }
      updateData.concurrencyLimit = parsedLimit;
    }

    if (maxRetries !== undefined) {
      const parsedRetries = parseInt(maxRetries, 10);
      if (isNaN(parsedRetries) || parsedRetries < 0) {
        return NextResponse.json({ error: 'Invalid maxRetries format or value' }, { status: 400 });
      }
      updateData.maxRetries = parsedRetries;
    }

    if (isPaused !== undefined) {
      if (typeof isPaused !== 'boolean') {
        return NextResponse.json({ error: 'isPaused must be a boolean' }, { status: 400 });
      }
      updateData.isPaused = isPaused;
    }

    if (retryPolicyId !== undefined) {
      if (retryPolicyId === null) {
        updateData.retryPolicyId = null;
      } else {
        const parsedPolicyId = parseInt(retryPolicyId, 10);
        if (isNaN(parsedPolicyId)) {
          return NextResponse.json({ error: 'Invalid retryPolicyId format' }, { status: 400 });
        }
        
        // Validate if policy exists
        const [policy] = await db
          .select()
          .from(retryPolicies)
          .where(eq(retryPolicies.id, parsedPolicyId))
          .limit(1);

        if (!policy) {
          return NextResponse.json({ error: 'Retry policy not found' }, { status: 400 });
        }
        updateData.retryPolicyId = parsedPolicyId;
      }
    }

    // Apply updates
    const [updatedQueue] = await db
      .update(queues)
      .set(updateData)
      .where(eq(queues.id, queueId))
      .returning();

    return NextResponse.json(updatedQueue);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
