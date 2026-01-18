import { auth0 } from '@/lib/auth0';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

export async function POST() {
  const session = await auth0.getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userProfile = await prisma.userProfile.findUnique({
      where: { auth0Id: session.user.sub }
    });

    if (!userProfile?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No billing account found' },
        { status: 400 }
      );
    }

    // Create billing portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: userProfile.stripeCustomerId,
      return_url: `${process.env.AUTH0_BASE_URL}/dashboard`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    console.error('Billing portal error:', error);
    return NextResponse.json(
      { error: 'Failed to create billing portal session' },
      { status: 500 }
    );
  }
}
