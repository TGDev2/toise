import { NextResponse, type NextRequest } from 'next/server';

/**
 * Garde anti-flash : redirige vers /login quand le cookie de présence de
 * session est absent. Ce n'est PAS une barrière de sécurité — l'API vérifie
 * le token Firebase sur chaque requête ; les pages gardent aussi leur
 * redirection côté client en secours.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has('chiffreo_auth');

  if (!hasSession) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/projects/:path*',
    '/quotes/:path*',
    '/settings/:path*',
    '/admin/:path*',
    '/subscription/:path*',
  ],
};
