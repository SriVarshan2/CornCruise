import { NextResponse } from 'next/server';
import { db } from '@/db';
import { retryPolicies } from '@/db/schema';
import { checkTenantAccess } from '@/lib/tenant';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orgIdStr = searchParams.get('orgId');

    if (!orgIdStr) {
      return NextResponse.json({ error: 'orgId query parameter is required to list retry policies for an organization' }, { status: 400 });
    }
    const orgId = parseInt(orgIdStr, 10);
    if (isNaN(orgId)) {
      return NextResponse.json({ error: 'Invalid orgId format' }, { status: 400 });
    }

    // Verify tenant access for the organization
    const access = await checkTenantAccess(request, { type: 'org', id: orgId });
    if (!access.success) {
      return NextResponse.json({ error: access.error }, { status: access.error?.includes('Unauthorized') ? 401 : 403 });
    }

    // Filter by orgId to prevent cross-tenant data leak
    const policies = await db
      .select()
      .from(retryPolicies)
      .where(eq(retryPolicies.orgId, orgId));

    return NextResponse.json(policies);
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
    const { name, type, baseDelayMs, maxDelayMs, orgId } = body;

    // Validate request inputs
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Retry policy name is required' }, { status: 400 });
    }
    if (!type || !['FIXED', 'LINEAR', 'EXPONENTIAL'].includes(type)) {
      return NextResponse.json({ error: 'type must be FIXED, LINEAR, or EXPONENTIAL' }, { status: 400 });
    }
    if (baseDelayMs === undefined || typeof baseDelayMs !== 'number' || baseDelayMs < 0) {
      return NextResponse.json({ error: 'baseDelayMs is required and must be non-negative' }, { status: 400 });
    }
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required to associate and verify tenant creation scope' }, { status: 400 });
    }

    const parsedOrgId = parseInt(orgId, 10);
    if (isNaN(parsedOrgId)) {
      return NextResponse.json({ error: 'Invalid orgId format' }, { status: 400 });
    }

    // Verify tenant access before allowing retry policy creation
    const access = await checkTenantAccess(request, { type: 'org', id: parsedOrgId });
    if (!access.success) {
      return NextResponse.json({ error: access.error }, { status: access.error?.includes('Unauthorized') ? 401 : 403 });
    }

    const [newPolicy] = await db
      .insert(retryPolicies)
      .values({
        orgId: parsedOrgId,
        name,
        type: type as 'FIXED' | 'LINEAR' | 'EXPONENTIAL',
        baseDelayMs,
        maxDelayMs: maxDelayMs !== undefined ? parseInt(maxDelayMs, 10) : null
      })
      .returning();

    return NextResponse.json(newPolicy, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
