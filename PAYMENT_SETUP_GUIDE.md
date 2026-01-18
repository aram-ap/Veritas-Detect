# Payment System Setup Guide

## Quick Start

The tiered payment system is now fully implemented! Here's how to get it running:

## 1. Database (Already Done ✅)

The database schema has been updated and pushed to production:
- User subscription tiers
- Usage tracking
- Stripe customer/subscription IDs
- Beta code system

## 2. Environment Variables

Add these to your `.env` file (or Vercel environment variables):

```bash
# Stripe Keys (Get from https://dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY=sk_test_YOUR_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET_HERE
```

### Getting Stripe Keys

1. **Create Stripe Account**
   - Go to https://stripe.com and sign up
   - No monthly fees! Pay only per transaction: 2.9% + $0.30

2. **Get API Keys**
   - Dashboard → Developers → API keys
   - Copy "Secret key" (starts with `sk_test_` for test mode)
   - Add to environment variables

3. **Set Up Webhook**
   - Dashboard → Developers → Webhooks
   - Click "Add endpoint"
   - URL: `https://your-domain.com/api/stripe/webhook`
   - Events to listen:
     - `checkout.session.completed`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
   - Copy "Signing secret" (starts with `whsec_`)
   - Add to environment variables

## 3. Test the System

### Test Locally

1. **Start the development server**
   ```bash
   cd apps/web
   npm run dev
   ```

2. **Test Beta Code Redemption**
   - Navigate to http://localhost:3000/beta
   - Enter code: `CruzHacks26` (gets 20/day for 1 month)
   - Or enter: `YoItsAram` (gets unlimited forever)

3. **Test Stripe Locally**
   ```bash
   # Install Stripe CLI
   brew install stripe/stripe-cli/stripe
   
   # Login
   stripe login
   
   # Forward webhooks to local server
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```

4. **Test Payment Flow**
   - Go to http://localhost:3000/dashboard
   - Click "Upgrade to Pro"
   - Use test card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
   - Verify webhook activates Pro tier

### Test in Production

1. **Deploy to Vercel/Production**
   ```bash
   git add .
   git commit -m "Add payment system"
   git push
   ```

2. **Set Production Environment Variables**
   - Use LIVE Stripe keys (not test keys)
   - Update webhook URL to production domain

3. **Test End-to-End**
   - Create new account
   - Verify starts with Free tier (5/day)
   - Test analysis until limit reached
   - Redeem beta code
   - Test Pro upgrade
   - Test billing portal

## 4. Subscription Tiers Reference

| Tier | Cost | Daily Limit | How to Access |
|------|------|-------------|---------------|
| **Free** | $0 | 5 analyses/day | Default |
| **Beta** | $0 | 20 analyses/day | Code: `CruzHacks26` |
| **Pro** | $10/month | 50 analyses/day | Stripe payment |
| **Unlimited** | $0 | No limit | Code: `YoItsAram` |

## 5. Key Features

✅ **Rate Limiting**
- Automatic daily counter reset at midnight
- 429 error with clear upgrade message
- Bypass for unlimited users

✅ **Beta Codes**
- Case-insensitive matching
- One-time redemption
- Auto-expiration after 1 month
- Prevents duplicate redemptions

✅ **Stripe Integration**
- Secure checkout sessions
- Webhook verification
- Automatic subscription management
- Self-service billing portal

✅ **Dashboard**
- Real-time usage tracking
- Visual progress bars
- Upgrade buttons
- Subscription management

## 6. API Endpoints

### User-Facing
- `GET /api/usage` - Get current tier and usage
- `POST /api/beta/redeem` - Redeem beta code
- `POST /api/checkout` - Start Pro checkout
- `POST /api/billing-portal` - Manage subscription

### Webhooks
- `POST /api/stripe/webhook` - Handle Stripe events

### Rate-Limited
- `POST /api/analyze` - Analyze article (rate limited by tier)

## 7. Testing Checklist

### Free Tier
- [ ] New user gets 5/day
- [ ] Can analyze 5 articles
- [ ] 6th analysis returns 429 error
- [ ] Counter resets next day
- [ ] Upgrade button shown

### Beta Tier
- [ ] Code "CruzHacks26" works (case-insensitive)
- [ ] Gets 20/day for 1 month
- [ ] Cannot redeem twice
- [ ] Auto-downgrades after expiry

### Pro Tier
- [ ] Checkout flow works
- [ ] Gets 50/day immediately
- [ ] Billing portal accessible
- [ ] Subscription updates work
- [ ] Cancellation downgrades to Free

### Unlimited Tier
- [ ] Code "YoItsAram" works
- [ ] No rate limiting
- [ ] Never expires
- [ ] Works for users named/emailed "yoitsaram"

## 8. Monitoring

### Stripe Dashboard
- View all subscriptions
- Track revenue
- Monitor failed payments
- Check webhook delivery

### Application Logs
- Watch for webhook events
- Monitor rate limit hits
- Track beta redemptions
- Check tier upgrades

## 9. Common Issues

### Issue: Webhook not working
**Solution:**
```bash
# Check webhook secret is correct
# Verify URL is accessible
# Check Stripe dashboard for delivery logs
# Look for signature verification errors
```

### Issue: Types not updating
**Solution:**
```bash
cd apps/web
npx prisma generate
# Restart IDE/TypeScript server
```

### Issue: Rate limit not resetting
**Solution:**
- Check server timezone
- Verify `lastResetDate` field
- Check reset logic in `/api/analyze`

## 10. Going Live

### Before Launch
- [ ] Test all payment flows
- [ ] Verify webhook in production
- [ ] Set up monitoring/alerts
- [ ] Test error scenarios
- [ ] Review Stripe settings
- [ ] Enable Stripe production mode

### Switch to Production
1. Replace test keys with live keys
2. Update webhook to production URL
3. Test with real card (charge yourself $10)
4. Verify webhook activates Pro tier
5. Test cancellation flow

### Post-Launch
- Monitor webhook delivery
- Check for failed payments
- Track conversion rates
- Review user feedback
- Monitor error logs

## 11. Support

For detailed documentation, see:
- `docs/PAYMENT_SYSTEM.md` - Complete system documentation
- `PAYMENT_IMPLEMENTATION_SUMMARY.md` - Implementation details

For Stripe help:
- https://stripe.com/docs
- https://dashboard.stripe.com

## 12. Success!

Your payment system is ready to go! 🎉

Key stats:
- ✅ 4 subscription tiers
- ✅ Automatic usage tracking
- ✅ Stripe integration (no monthly fees)
- ✅ Beta code system
- ✅ Self-service billing
- ✅ Beautiful dashboard UI
- ✅ Complete documentation

Just add your Stripe keys and start accepting payments!
