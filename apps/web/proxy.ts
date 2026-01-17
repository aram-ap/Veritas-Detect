import { NextResponse } from 'next/server';
import { auth0 } from './src/lib/auth0';

export async function proxy(request: Request) {
  const origin = request.headers.get('origin');
  
  // Handle Auth0 authentication
  const auth0Response = await auth0.middleware(request);
  
  // Apply CORS headers for Chrome Extensions
  if (origin && origin.startsWith('chrome-extension://')) {
    const response = auth0Response || NextResponse.next();
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    return response;
  }

  return auth0Response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
