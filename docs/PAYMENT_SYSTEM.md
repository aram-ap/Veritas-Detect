# Payment System Documentation

## Overview

Veritas now features a comprehensive tiered payment system with usage tracking and beta code redemption. The system uses **Stripe** for payment processing (no monthly fees, just per-transaction costs).

## Subscription Tiers

### Free Tier
- **Cost**: Free
- **Daily Limit**: 5 article analyses per day
- **Features**: Basic analysis with trust scores, bias detection, and misinformation flagging

### Beta User Tier
- **Cost**: Free with code redemption
- **Daily Limit**: 20 article analyses per day
- **Duration**: 1 month from redemption
- **Beta Code**: `CruzHacks26` (case-insensitive)
- **Features**: Same as Free tier but with higher daily limits

### Pro Tier
- **Cost**: $10/month (recurring subscription)
- **Daily Limit**: 50 article analyses per day
- **Features**: Same as Free tier but with significantly higher daily limits
- **Management**: Users can manage/cancel via Stripe billing portal

### Unlimited Tier
- **Cost**: Free (special access)
- **Daily Limit**: No limits
- **Access Code**: `YoItsAram` (case-insensitive)
- **Features**: Unlimited analyses, no restrictions

## Database Schema

The following fields were added to the `UserProfile` model:

```prisma
subscriptionTier     String   @default("free")    // free, beta, pro, unlimited
dailyAnalysisLimit   Int      @default(5)         // Daily analysis limit
lastResetDate        DateTime @default(now())     // Last daily counter reset
todayAnalysisCount   Int      @default(0)         // Today's usage count
stripeCustomerId     String?  @unique             // Stripe customer ID
stripeSubscriptionId String?  @unique             // Stripe subscription ID
subscriptionEndsAt   DateTime?                    // Expiration (for beta users)
```

A new `UsageHistory` model tracks historical usage:

```prisma
model UsageHistory {
  id        String   @id @default(uuid())
  userId    String
  date      DateTime @default(now())
  count     Int      @default(0)
  user      UserProfile @relation(...)
}
```

## API Endpoints

### Rate-Limited Endpoints

#### `POST /api/analyze`
- **Rate Limited**: Yes
- **Behavior**: 
  - Checks user's tier and daily limit
  - Resets counter at midnight
  - Returns 429 error when limit reached
  - Unlimited users bypass all checks
  - Beta users automatically downgraded when subscription expires

### Usage & Subscription Management

#### `GET /api/usage`
- **Auth Required**: Yes
- **Returns**: Current tier, daily limit, usage count, remaining analyses

#### `POST /api/beta/redeem`
- **Auth Required**: Yes
- **Body**: `{ "code": "CruzHacks26" }` or `{ "code": "YoItsAram" }`
- **Returns**: Success message with new tier details

#### `POST /api/checkout`
- **Auth Required**: Yes
- **Returns**: Stripe checkout URL for Pro subscription
- **Redirects**: 
  - Success: `/dashboard?success=true`
  - Cancel: `/dashboard?canceled=true`

#### `POST /api/billing-portal`
- **Auth Required**: Yes
- **Returns**: Stripe billing portal URL for subscription management

#### `POST /api/stripe/webhook`
- **Auth Required**: No (Stripe signature verification)
- **Handles**: 
  - `checkout.session.completed`: Activates Pro subscription
  - `customer.subscription.updated`: Updates subscription status
  - `customer.subscription.deleted`: Downgrades to Free tier

## Frontend Pages

### `/beta` - Beta Code Redemption
- Simple form to enter beta codes
- Validates codes and updates user tier
- Redirects to dashboard on success
- Shows error messages for invalid/already-redeemed codes

### `/dashboard` - Enhanced Dashboard
- **New Features**:
  - Subscription card showing current tier
  - Usage progress bar (daily analyses)
  - "Upgrade to Pro" button for free/beta users
  - "Manage Billing" button for Pro users
  - "Beta User" link in navigation
  - Tier comparison table

## Stripe Setup

### 1. Create Stripe Account
1. Sign up at [stripe.com](https://stripe.com)
2. No monthly fees - pay only per transaction (2.9% + $0.30)

### 2. Get API Keys
1. Go to [Stripe Dashboard > API Keys](https://dashboard.stripe.com/apikeys)
2. Copy your **Secret Key** (starts with `sk_test_` for test mode)
3. Add to `.env` file:
   ```
   STRIPE_SECRET_KEY=sk_test_your_key_here
   ```

### 3. Set Up Webhook
1. Go to [Stripe Dashboard > Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Set URL: `https://your-domain.com/api/stripe/webhook`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Copy the **Signing Secret** (starts with `whsec_`)
6. Add to `.env` file:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
   ```

### 4. Test Webhook Locally
Use Stripe CLI for local testing:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### 5. Test Cards
Use these test cards in Stripe test mode:
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- Use any future expiry date and any CVC

## Usage Flow

### For Free Users
1. User signs up → Gets Free tier (5/day)
2. User analyzes articles → Counter increments
3. User hits limit → Gets 429 error with upgrade prompt
4. User can:
   - Wait until tomorrow (counter resets at midnight)
   - Enter beta code at `/beta`
   - Upgrade to Pro via dashboard

### For Beta Users
1. User enters `CruzHacks26` at `/beta`
2. Gets 20 analyses/day for 1 month
3. After 1 month → Auto-downgraded to Free tier
4. Can upgrade to Pro anytime

### For Pro Users
1. User clicks "Upgrade to Pro" → Redirected to Stripe checkout
2. Completes payment → Webhook activates Pro tier (50/day)
3. Subscription renews monthly automatically
4. User can manage/cancel via "Manage Billing" button

### For Unlimited Users
1. User enters `YoItsAram` at `/beta`
2. Gets unlimited analyses with no daily limit
3. Never expires

## Special User Detection

The system automatically detects unlimited users by checking:
- Email contains "yoitsaram" (case-insensitive)
- Name contains "yoitsaram" (case-insensitive)

These users bypass all rate limits regardless of their tier in the database.

## Daily Reset Logic

The system resets daily counters at midnight (00:00:00) local server time:

```typescript
const today = new Date();
today.setHours(0, 0, 0, 0);
const lastReset = new Date(userProfile.lastResetDate);
lastReset.setHours(0, 0, 0, 0);

if (lastReset < today) {
  // Reset counter
}
```

## Error Handling

### 429 Too Many Requests
Returned when user exceeds daily limit:
```json
{
  "error": "Daily limit reached",
  "limit": 5,
  "used": 5,
  "tier": "free",
  "message": "You've reached your daily limit of 5 analyses. Upgrade to Pro for more!"
}
```

### 400 Bad Request (Beta Redemption)
- Invalid code
- Already redeemed beta
- Already has Pro/Unlimited

## Security Considerations

1. **Webhook Verification**: All Stripe webhooks are verified using signature
2. **Auth Required**: All user-facing endpoints require Auth0 authentication
3. **Rate Limiting**: Prevents abuse of the analysis API
4. **Secure Keys**: Never commit Stripe keys to git

## Monitoring & Analytics

Track these metrics:
- Conversion rate (Free → Pro)
- Beta code redemption rate
- Average analyses per user per tier
- Churn rate for Pro users
- Revenue (Stripe dashboard)

## Future Enhancements

Potential improvements:
- Annual billing option (discount)
- Enterprise tier for teams
- Multiple beta codes with different limits
- Usage analytics in dashboard
- Email notifications for limit warnings
- Webhook retry logic
- More granular usage history

## Troubleshooting

### Issue: Webhook not receiving events
**Solution**: 
- Check webhook URL is correct and publicly accessible
- Verify webhook secret matches
- Check Stripe dashboard for webhook delivery logs

### Issue: User tier not updating after payment
**Solution**:
- Check webhook is configured correctly
- Verify webhook events are being received
- Check database for `stripeSubscriptionId`
- Review webhook handler logs

### Issue: Daily limit not resetting
**Solution**:
- Check server timezone configuration
- Verify `lastResetDate` is being updated
- Review reset logic in `/api/analyze`

### Issue: Beta code not working
**Solution**:
- Verify code is exactly `CruzHacks26` (case-insensitive)
- Check if user already redeemed beta
- Check if user has Pro/Unlimited tier

## Support

For payment-related issues:
1. Check Stripe dashboard for payment/subscription status
2. Review webhook delivery logs
3. Check application logs for error messages
4. Verify environment variables are set correctly
