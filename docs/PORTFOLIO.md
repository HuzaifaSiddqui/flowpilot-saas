# Using FlowPilot as an Upwork portfolio project

Only claim what you can show. Clients check, and a small honest portfolio beats an inflated one.

## What is verified in this repo

| Claim | Evidence |
| --- | --- |
| Multi-tenant SaaS with auth, workspaces, projects, tasks, clients, team roles | `src/`, screenshots 03–14, 20 |
| Row Level Security enforced in Postgres | `supabase/migrations/*_security.sql`, `tests/integration/rls.test.ts` (46 tests against real Postgres via PGlite) |
| Plan limits enforced server-side (not just in the UI) | `*_logic.sql` triggers, tested; screenshots 11, 15 |
| Stripe billing flow (Checkout, Portal, webhook) | `supabase/functions/`, 17 webhook and billing unit tests |
| 107 unit/integration tests plus 17 Playwright E2E | `npm test`, `npm run test:e2e`, CI workflow |
| Responsive UI | screenshots 21–23 |

## What is NOT yet true (do these before claiming it)

- **Live deployment.** Nothing is deployed. Follow `docs/GO_LIVE.md` (about 30 minutes), then put the URL in the README.
- **Real Supabase and Stripe.** Screenshots were taken in Demo Mode (local data, Stripe simulated). The Edge Function glue (`index.ts` files) is not exercised in CI. Run it once in Stripe **test mode** and capture real evidence (Checkout page, webhook delivery log, plan changing in the app).
- **Not built with Lovable.** The original brief is "Lovable MVP → Production SaaS". This codebase was written directly, so do not describe it as a Lovable export or show a fake before/after. If you want that story, generate a genuine baseline in Lovable with the same prompt, record what it got wrong (for example missing RLS, client-trusted plan checks), and use that as your honest "before". Otherwise retitle the project, for example **"FlowPilot: production-grade multi-tenant SaaS"**, and change the cover headline in `docs/portfolio/src/cover.html`.
- **Invitations** are in-app only (no email is sent). Light theme only.

## Suggested Upwork copy (edit once deployed)

**Title:** FlowPilot — Multi-tenant SaaS with Supabase RLS, Stripe Billing & CI

**Description:**
A team and client management SaaS built to production standards: React + TypeScript, Supabase Auth and Postgres with Row Level Security, role-based access, server-enforced plan limits, and Stripe subscriptions (Checkout, Customer Portal, signature-verified idempotent webhooks). 107 automated tests, including RLS tests that run the real migrations on Postgres, plus 17 Playwright end-to-end tests and a GitHub Actions pipeline.

**Skills tags:** React, TypeScript, Supabase, PostgreSQL, Stripe API, Tailwind CSS, Playwright

## Upload order (Upwork allows images and a video)

1. `docs/portfolio/01-cover.png`
2. `docs/portfolio/02-functional-app.png`
3. `docs/portfolio/03-architecture.png`
4. Real live-app screenshots (replace Demo Mode ones after deploying)
5. A 60–90 s walkthrough video: sign up, create a project, hit the limit, upgrade, change a role as a member.

## Regenerating screenshots

`npm run screenshots`, then rebuild the covers from `docs/portfolio/src`.
