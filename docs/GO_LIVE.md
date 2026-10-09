# Go live: Supabase → Stripe → Vercel

Everything below uses **test mode** for payments. Time: ~30–40 minutes.

## 1. Supabase (database + auth)
1. Create a project (e.g. `flowpilot-dev`). Copy **Project URL** and **anon key** (Settings → API).
2. Install the CLI (`npm i -g supabase`), then:
   ```bash
   supabase login
   supabase link --project-ref <ref>
   supabase db push            # applies supabase/migrations/*
   ```
3. Auth → URL Configuration: set **Site URL** to your deployed URL and add `http://localhost:5173/**` and `https://<your-domain>/**` to Redirect URLs. Keep **Confirm email** enabled.
4. Create `.env.local`:
   ```
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```
   `npm run dev` now runs against the real backend (the demo banner disappears).
5. (Optional) seed demo data on a **throwaway** project: run `supabase/seed.sql` in the SQL editor.

> Never put the service-role key in `.env.local` or Vercel env vars for the frontend.

## 2. Stripe (test mode)
1. Products → create **Pro** ($19/month) and **Team** ($49/month) recurring prices. Copy the two `price_…` IDs.
2. Developers → API keys → copy the **secret** test key.
3. Settings → Billing → **Customer portal**: enable it (allow plan changes + cancellation).

## 3. Edge Functions
```bash
cat > supabase/.env.local <<EOT
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_TEAM=price_...
SITE_URL=https://<your-domain>
EOT
supabase secrets set --env-file supabase/.env.local
supabase functions deploy create-checkout billing-portal stripe-webhook
```
(`supabase/config.toml` already sets `verify_jwt = false` for the webhook only.)

Stripe → Developers → Webhooks → add endpoint `https://<ref>.supabase.co/functions/v1/stripe-webhook` with events:
`checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.paid`, `invoice.payment_failed`.
Copy the **signing secret** and run `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...`.

## 4. Verify billing end-to-end (this is your evidence)
- Billing page → *Upgrade to Pro* → pay with `4242 4242 4242 4242` → plan flips to Pro.
- Stripe Dashboard → Webhooks → event log shows `200` deliveries. **Screenshot this.**
- Resend an event from the Stripe dashboard → response says `duplicate` (idempotency).
- Use test card `4000 0000 0000 0341` (attaches, then fails on renewal) or Customer Portal → cancel to exercise failure/cancel paths.
- `stripe trigger invoice.payment_failed` with the Stripe CLI is a quick alternative.

## 5. Deploy the frontend (Vercel)
1. Import the GitHub repo. Framework preset: **Vite** (`vercel.json` already contains build config, SPA rewrite and security headers).
2. Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
3. Deploy, then set Supabase **Site URL** + `SITE_URL` secret to the final URL and redeploy the functions.
4. GitHub → Settings → Branches: protect `main`, require the `verify` and `e2e` checks. Rollback = *Promote* a previous deployment in Vercel.

## 6. Production checklist
- [ ] Separate `flowpilot-prod` Supabase project (dev experiments never touch live data)
- [ ] Migrations applied via `supabase db push`, reviewed in PR
- [ ] Auth redirects + password reset tested on the deployed URL
- [ ] Webhook signature + retry verified in Stripe dashboard
- [ ] Backups: enable PITR/daily backups (Supabase → Database → Backups); do a restore rehearsal before claiming DR readiness
- [ ] Error monitoring: add Sentry in `reportError()` (`src/lib/errors.ts`)
- [ ] Run Lighthouse on the deployed URL and record real scores
