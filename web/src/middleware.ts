import { NextRequest, NextResponse } from 'next/server';

const PUBLIC = ['/login', '/remover-dados'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
  // ponytail: só checa presença do cookie; validade real é checada em (app)/layout via /auth/me
  if (!req.cookies.has('access_token') && !req.cookies.has('refresh_token')) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next|api|map/|favicon.ico).*)'] };
