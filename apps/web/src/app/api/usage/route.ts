import { auth0 } from '@/lib/auth0';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth0.getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get or create user profile
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

    // Check if beta subscription has expired
    if (userProfile.subscriptionTier === 'beta' && userProfile.subscriptionEndsAt) {
      if (new Date() > new Date(userProfile.subscriptionEndsAt)) {
        // Beta expired, revert to free tier
        userProfile = await prisma.userProfile.update({
          where: { id: userProfile.id },
          data: {
            subscriptionTier: 'free',
            dailyAnalysisLimit: 5,
          }
        });
      }
    }

    // Check if unlimited user
    const isUnlimitedUser = session.user.email?.toLowerCase() === 'yoitsaram' || 
                            session.user.name?.toLowerCase() === 'yoitsaram' ||
                            userProfile.email?.toLowerCase() === 'yoitsaram' ||
                            userProfile.name?.toLowerCase() === 'yoitsaram';

    return NextResponse.json({
      tier: isUnlimitedUser ? 'unlimited' : userProfile.subscriptionTier,
      dailyLimit: isUnlimitedUser ? -1 : userProfile.dailyAnalysisLimit,
      used: userProfile.todayAnalysisCount,
      remaining: isUnlimitedUser ? -1 : Math.max(0, userProfile.dailyAnalysisLimit - userProfile.todayAnalysisCount),
      subscriptionEndsAt: userProfile.subscriptionEndsAt,
      stripeCustomerId: userProfile.stripeCustomerId,
    });
  } catch (error) {
    console.error('Usage error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
