import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJWT, extractToken } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 1. Bypass auth routes and cron execute route
  if (path.startsWith('/api/auth/') || path === '/api/cron/execute') {
    return NextResponse.next();
  }

  // 2. Protect dashboard routes
  if (path.startsWith('/dashboard')) {
    const token = request.cookies.get('token');
    if (!token) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 3. Protect API routes
  const isApiRoute =
    path.startsWith('/api/organizations') ||
    path.startsWith('/api/projects') ||
    path.startsWith('/api/queues') ||
    path.startsWith('/api/jobs');

  if (isApiRoute) {
    const token = extractToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid token' }, { status: 401 });
    }

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

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/organizations/:path*',
    '/api/projects/:path*',
    '/api/queues/:path*',
    '/api/jobs/:path*',
    '/dashboard/:path*'
  ],
};
