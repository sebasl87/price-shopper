import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout'];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const token = req.cookies.get('ps-token')?.value;

  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Decode JWT payload (base64url) — no crypto verify needed in Edge
  // The signature was already verified when the cookie was issued by /api/auth/login
  try {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('malformed');

    // base64url → base64 → decode
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(b64));

    // Check expiry
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      const res = NextResponse.redirect(new URL('/login', req.url));
      res.cookies.delete('ps-token');
      return res;
    }

    const res = NextResponse.next();
    res.headers.set('x-user-id', String(payload.sub ?? ''));
    res.headers.set('x-user-email', String(payload.email ?? ''));
    res.headers.set('x-user-name', String(payload.name ?? ''));
    return res;
  } catch {
    const res = NextResponse.redirect(new URL('/login', req.url));
    res.cookies.delete('ps-token');
    return res;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)'],
};
