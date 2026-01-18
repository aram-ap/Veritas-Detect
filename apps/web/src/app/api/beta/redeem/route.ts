import { auth0 } from '@/lib/auth0';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

interface RedeemRequest {
  code: string;
}

export async function POST(req: Request) {
  const session = await auth0.getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: RedeemRequest = await req.json();
    const code = body.code?.trim();

    if (!code) {
      return NextResponse.json(
        { error: 'Code is required' },
        { status: 400 }
      );
    }

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

    // Check if code is valid (case insensitive)
    const normalizedCode = code.toLowerCase();
    
    if (normalizedCode === 'cruzhacks26') {
      // Check if user already has beta or better tier
      if (userProfile.subscriptionTier === 'pro' || userProfile.subscriptionTier === 'unlimited') {
        return NextResponse.json(
          { error: 'You already have a premium subscription' },
          { status: 400 }
        );
      }

      // Check if user already redeemed beta
      if (userProfile.subscriptionTier === 'beta' && userProfile.subscriptionEndsAt) {
        return NextResponse.json(
          { error: 'You have already redeemed a beta code' },
          { status: 400 }
        );
      }

      // Grant 1 month of beta access with 20 analyses per day
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      await prisma.userProfile.update({
        where: { id: userProfile.id },
        data: {
          subscriptionTier: 'beta',
          dailyAnalysisLimit: 20,
          subscriptionEndsAt: expiresAt,
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Beta access granted! You now have 20 analyses per day for 1 month.',
        tier: 'beta',
        dailyLimit: 20,
        expiresAt: expiresAt.toISOString(),
      });
    } else if (normalizedCode === 'yoitsaram') {
      // Check how many users already have unlimited tier
      const unlimitedCount = await prisma.userProfile.count({
        where: { subscriptionTier: 'unlimited' }
      });

      if (unlimitedCount >= 3) {
        return NextResponse.json(
          { error: 'This coupon has reached its maximum usage limit' },
          { status: 400 }
        );
      }

      // Special unlimited access
      await prisma.userProfile.update({
        where: { id: userProfile.id },
        data: {
          subscriptionTier: 'unlimited',
          dailyAnalysisLimit: 999999,
          subscriptionEndsAt: null,
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Unlimited access granted! You have no daily limits.',
        tier: 'unlimited',
        dailyLimit: -1,
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid beta code' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Beta redeem error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
