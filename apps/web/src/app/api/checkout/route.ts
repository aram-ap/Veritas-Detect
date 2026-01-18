import { auth0 } from '@/lib/auth0';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-12-15.clover',
});

export async function POST(req: Request) {
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

    // Check if user already has a pro subscription
    if (userProfile.subscriptionTier === 'pro' || userProfile.subscriptionTier === 'unlimited') {
      return NextResponse.json(
        { error: 'You already have a premium subscription' },
        { status: 400 }
      );
    }

    // Create or get Stripe customer
    let customerId = userProfile.stripeCustomerId;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: session.user.email || undefined,
        metadata: {
          auth0Id: session.user.sub,
          userId: userProfile.id,
        },
      });
      
      customerId = customer.id;
      
      await prisma.userProfile.update({
        where: { id: userProfile.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create checkout session for Pro tier ($10/month)
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Veritas Pro',
              description: '50 article analyses per day',
            },
            unit_amount: 1000, // $10.00 in cents
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.AUTH0_BASE_URL}/dashboard?success=true`,
      cancel_url: `${process.env.AUTH0_BASE_URL}/dashboard?canceled=true`,
      metadata: {
        userId: userProfile.id,
        auth0Id: session.user.sub,
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
