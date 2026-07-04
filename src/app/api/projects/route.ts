import { NextResponse } from 'next/server';
import { db } from '@/db';
import { projects } from '@/db/schema';
import { checkTenantAccess } from '@/lib/tenant';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const { searchParams } = new URL(request.url);
    const orgIdStr = searchParams.get('orgId');

    if (!orgIdStr) {
      return NextResponse.json({ error: 'orgId query parameter is required' }, { status: 400 });
    }
    const orgId = parseInt(orgIdStr, 10);
    if (isNaN(orgId)) {
      return NextResponse.json({ error: 'Invalid orgId format' }, { status: 400 });
    }

    // Verify tenant access
    const access = await checkTenantAccess(authHeader, { type: 'org', id: orgId });
    if (!access.success) {
      return NextResponse.json({ error: access.error }, { status: access.error?.includes('Unauthorized') ? 401 : 403 });
    }

    const orgProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.orgId, orgId));

    return NextResponse.json(orgProjects);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const body = await request.json();
    const { name, orgId } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }
    if (!orgId) {
      return NextResponse.json({ error: 'orgId is required' }, { status: 400 });
    }
    const parsedOrgId = parseInt(orgId, 10);
    if (isNaN(parsedOrgId)) {
      return NextResponse.json({ error: 'Invalid orgId format' }, { status: 400 });
    }

    // Verify tenant access
    const access = await checkTenantAccess(authHeader, { type: 'org', id: parsedOrgId });
    if (!access.success) {
      return NextResponse.json({ error: access.error }, { status: access.error?.includes('Unauthorized') ? 401 : 403 });
    }

    const [newProject] = await db
      .insert(projects)
      .values({
        name,
        orgId: parsedOrgId
      })
      .returning();

    return NextResponse.json(newProject, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
