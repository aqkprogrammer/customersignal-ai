# Stripe setup

Billing is optional: without `STRIPE_SECRET_KEY`, workspaces stay on Free and admins can assign plans manually
(Admin → Subscriptions → Adjust). With Stripe configured:

1. **API keys** (Stripe Dashboard → Developers → API keys). Use test keys first.
   ```
   STRIPE_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   ```
2. **Prices.** Nothing to create by hand: the first checkout for a paid plan creates the Stripe product and monthly
   price from the plan's admin-set price and stores the ids. To use existing prices instead, paste the price id into
   Admin → Plans & Pricing → *Stripe price id*. Changing a plan's price in the admin clears the stored price id so a new
   Stripe price is created on the next checkout (existing subscribers keep their price).
3. **Webhook.** Dashboard → Developers → Webhooks → Add endpoint `https://app.yourdomain.com/api/v1/billing/webhook`
   with events:
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_succeeded`, `invoice.payment_failed`,
   `charge.refunded`. Copy the signing secret to `STRIPE_WEBHOOK_SECRET=whsec_...`.
4. **Customer portal.** Dashboard → Settings → Billing → Customer portal: enable payment-method updates, invoice
   history, cancellation and plan switching.
5. **Local testing:**
   ```bash
   stripe listen --forward-to localhost:8000/api/v1/billing/webhook
   ```
   Use the printed `whsec_...` as `STRIPE_WEBHOOK_SECRET` and test card `4242 4242 4242 4242`.

## Lifecycle handled

Checkout (with plan trial days for first-time subscribers) · in-place upgrades/downgrades with proration ·
cancel at period end / resume · renewal and invoice history · failed payments (status `past_due`, in-app + email
notice) · refunds · cancellation drops the workspace back to Free. Webhooks are signature-verified and idempotent
(`stripe_events`). Limits and features are always enforced server-side from the plan record.
