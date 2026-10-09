// Pure billing helpers — no Deno or Node APIs, so they run in Edge Functions AND in Vitest.

export type PaidPlan = "pro" | "team";
export type PlanKey = "free" | PaidPlan;

export interface PriceMap {
  pro: string;
  team: string;
}

/** Statuses that unlock paid features. Everything else (past_due, canceled, unpaid, …) falls back to Free. */
export const ENTITLING_STATUSES = ["active", "trialing"] as const;

export function grantsPaidAccess(status: string): boolean {
  return (ENTITLING_STATUSES as readonly string[]).includes(status);
}

export function isPaidPlan(value: unknown): value is PaidPlan {
  return value === "pro" || value === "team";
}

/** Server-approved price for a plan. The browser only ever sends a plan NAME, never a price ID. */
export function priceForPlan(plan: PaidPlan, prices: PriceMap): string {
  const id = prices[plan];
  if (!id) throw new Error(`No Stripe price configured for plan "${plan}"`);
  return id;
}

export function planFromPriceId(priceId: string | null | undefined, prices: PriceMap): PlanKey {
  if (priceId && priceId === prices.pro) return "pro";
  if (priceId && priceId === prices.team) return "team";
  return "free";
}

/** Stripe API versions place the subscription id on different invoice fields. */
export function extractSubscriptionId(invoice: {
  subscription?: string | { id: string } | null;
  parent?: { subscription_details?: { subscription?: string | { id: string } | null } | null } | null;
}): string | null {
  const raw = invoice.parent?.subscription_details?.subscription ?? invoice.subscription ?? null;
  if (!raw) return null;
  return typeof raw === "string" ? raw : raw.id;
}

export interface StripeSubscriptionLike {
  id: string;
  status: string;
  customer: string | { id: string };
  cancel_at_period_end: boolean;
  metadata?: Record<string, string> | null;
  current_period_end?: number;
  items: { data: Array<{ price: { id: string }; current_period_end?: number }> };
}

export interface SubscriptionRow {
  workspace_id: string | null;
  plan: PlanKey;
  status: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

/** Translate a Stripe subscription into our subscriptions row (the single source of entitlement truth). */
export function toSubscriptionRow(sub: StripeSubscriptionLike, prices: PriceMap): SubscriptionRow {
  const item = sub.items.data[0];
  const periodEnd = sub.current_period_end ?? item?.current_period_end;
  return {
    workspace_id: sub.metadata?.workspace_id ?? null,
    plan: planFromPriceId(item?.price.id, prices),
    status: sub.status,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end,
  };
}

export const HANDLED_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
] as const;

export function isHandledEvent(type: string): boolean {
  return (HANDLED_EVENTS as readonly string[]).includes(type);
}

/** Roles allowed to manage billing. Owner only — admins and members never reach Stripe. */
export function canManageBilling(role: string | null | undefined): boolean {
  return role === "owner";
}
