import { auth0 } from '@/lib/auth0';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const session = await auth0.getSession();

    if (!session || !session.user) {
      return NextResponse.json({ authenticated: false }, { status: 200 });
    }

    // Get user profile to check limits
    let userProfile = await prisma.userProfile.findUnique({
      where: { auth0Id: session.user.sub }
    });

    if (!userProfile) {
      userProfile = await prisma.userProfile.create({
        data: {
          auth0Id: session.user.sub,
          email: session.user.email,
          name: session.user.name,
        }
      });
    }

    // Check if we need to reset daily counter
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastReset = new Date(userProfile.lastResetDate);
    lastReset.setHours(0, 0, 0, 0);

    if (lastReset < today) {
      // Reset daily counter
      userProfile = await prisma.userProfile.update({
        where: { id: userProfile.id },
        data: {
          todayAnalysisCount: 0,
          lastResetDate: new Date(),
        }
      });
    }

    // Special handling for unlimited user
    const isUnlimitedUser = session.user.email?.toLowerCase() === 'yoitsaram' || 
                            session.user.name?.toLowerCase() === 'yoitsaram' ||
                            userProfile.email?.toLowerCase() === 'yoitsaram' ||
                            userProfile.name?.toLowerCase() === 'yoitsaram';

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
      },
      usage: {
        used: userProfile.todayAnalysisCount,
        limit: userProfile.dailyAnalysisLimit,
        tier: userProfile.subscriptionTier,
        isUnlimited: isUnlimitedUser
      }
    });
  } catch (error) {
    console.error('Extension token error:', error);
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
}
