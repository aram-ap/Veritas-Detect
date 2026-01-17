import { auth0 } from '@/lib/auth0';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const session = await auth0.getSession();

    if (!session || !session.user) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    // Create a non-HttpOnly cookie that the extension can read
    const cookieStore = await cookies();

    // Simple flag that extension can read (not sensitive data)
    cookieStore.set('veritas-ext-auth', 'true', {
      httpOnly: false, // Extension can read this
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return NextResponse.json({
      authenticated: true,
      user: {
        name: session.user.name,
        email: session.user.email,
        nickname: session.user.nickname,
      }
    });
  } catch (error) {
    console.error('Extension token error:', error);
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
}
