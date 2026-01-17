import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  const isExtensionOrigin = origin?.startsWith('chrome-extension://');

  console.log(`[Middleware] Method: ${request.method}, URL: ${request.url}, Origin: ${origin}, IsExtension: ${isExtensionOrigin}`);

  if (isExtensionOrigin) {
    const headers = new Headers();
    headers.set('Access-Control-Allow-Origin', origin ?? '');
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    headers.set('Access-Control-Allow-Credentials', 'true');

    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 204, headers });
    }

    const response = NextResponse.next();
    headers.forEach((value, key) => response.headers.set(key, value));
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
