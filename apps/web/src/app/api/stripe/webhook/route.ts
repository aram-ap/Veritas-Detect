import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        
        if (session.mode === 'subscription' && session.subscription) {
          const userId = session.metadata?.userId;
          
          if (userId) {
            await prisma.userProfile.update({
              where: { id: userId },
              data: {
                subscriptionTier: 'pro',
                dailyAnalysisLimit: 50,
                stripeSubscriptionId: session.subscription as string,
                subscriptionEndsAt: null, // Pro subscriptions don't expire
              },
            });
            
            console.log(`Subscription activated for user ${userId}`);
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        
        const userProfile = await prisma.userProfile.findUnique({
          where: { stripeSubscriptionId: subscription.id },
        });

        if (userProfile) {
          // Check if subscription is active or past_due
          if (subscription.status === 'active' || subscription.status === 'trialing') {
            await prisma.userProfile.update({
              where: { id: userProfile.id },
              data: {
                subscriptionTier: 'pro',
                dailyAnalysisLimit: 50,
              },
            });
          } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
            // Downgrade to free tier
            await prisma.userProfile.update({
              where: { id: userProfile.id },
              data: {
                subscriptionTier: 'free',
                dailyAnalysisLimit: 5,
              },
            });
          }
          
          console.log(`Subscription updated for user ${userProfile.id}: ${subscription.status}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        
        const userProfile = await prisma.userProfile.findUnique({
          where: { stripeSubscriptionId: subscription.id },
        });

        if (userProfile) {
          await prisma.userProfile.update({
            where: { id: userProfile.id },
            data: {
              subscriptionTier: 'free',
              dailyAnalysisLimit: 5,
              stripeSubscriptionId: null,
            },
          });
          
          console.log(`Subscription canceled for user ${userProfile.id}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    );
  }
}

// Disable body parsing for Stripe webhooks
export const dynamic = 'force-dynamic';
