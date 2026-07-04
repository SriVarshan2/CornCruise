import { NextResponse } from 'next/server';
import { db } from '@/db';
import { organizations, organizationMembers } from '@/db/schema';
import { verifyJWT } from '@/lib/auth';
import { eq } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid token' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const payload = await verifyJWT(token);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized: Session expired or invalid' }, { status: 401 });
    }

    const userOrgs = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        createdAt: organizations.createdAt
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizationMembers.orgId, organizations.id))
      .where(eq(organizationMembers.userId, payload.userId));

    return NextResponse.json(userOrgs);
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
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid token' }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const payload = await verifyJWT(token);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized: Session expired or invalid' }, { status: 401 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Organization name is required' }, { status: 400 });
    }

    // Create Organization
    const [newOrg] = await db
      .insert(organizations)
      .values({ name })
      .returning();

    // Create member association as owner
    const [member] = await db
      .insert(organizationMembers)
      .values({
        orgId: newOrg.id,
        userId: payload.userId,
        role: 'owner'
      })
      .returning();

    const result = {
      ...newOrg,
      role: member.role
    };

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
