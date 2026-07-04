import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJWT } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Bypass auth routes
  if (path.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  // Bypass cron execution endpoint which uses its own CRON_SECRET authorization
  if (path === '/api/cron/execute') {
    return NextResponse.next();
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized: Missing or invalid token' }, { status: 401 });
  }

  const token = authHeader.substring(7);
  const payload = await verifyJWT(token);
  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized: Session expired or invalid' }, { status: 401 });
  }

  // Propagate user context in headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', String(payload.userId));
  requestHeaders.set('x-user-email', payload.email);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

// Protect all routes touching jobs, queues, projects, and organizations
export const config = {
  matcher: [
    '/api/organizations/:path*',
    '/api/projects/:path*',
    '/api/queues/:path*',
    '/api/jobs/:path*'
  ],
};
