// Webhook business logic with injected dependencies — so idempotency, retries and
// out-of-order delivery can be unit-tested without Deno, Stripe or a database.
import {
  extractSubscriptionId, isHandledEvent, toSubscriptionRow,
  type PriceMap, type StripeSubscriptionLike, type SubscriptionRow,
} from "./billing.ts";

export interface WebhookEvent { id: string; type: string; data: { object: Record<string, unknown> } }

export interface WebhookDeps {
  prices: PriceMap;
  /** Insert the event id. Must return "duplicate" when it already exists (unique violation). */
  claimEvent(id: string, type: string): Promise<"claimed" | "duplicate">;
  /** Remove the claim so Stripe's retry is processed again. */
  releaseEvent(id: string): Promise<void>;
  /** Authoritative, latest subscription state from Stripe. */
  retrieveSubscription(id: string): Promise<StripeSubscriptionLike>;
  workspaceByCustomer(customerId: string): Promise<string | null>;
  upsertSubscription(workspaceId: string, row: Omit<SubscriptionRow, "workspace_id">): Promise<void>;
}

export type WebhookResult = { status: "ignored" | "duplicate" | "processed" | "noop" };

export function subscriptionIdFromEvent(event: WebhookEvent): string | null {
  const o = event.data.object as Record<string, unknown> & { id?: string; subscription?: string | { id: string } | null };
  switch (event.type) {
    case "checkout.session.completed":
      return typeof o.subscription === "string" ? o.subscription : o.subscription?.id ?? null;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return o.id ?? null;
    case "invoice.paid":
    case "invoice.payment_failed":
      return extractSubscriptionId(o as never);
    default:
      return null;
  }
}

/**
 * 1. ignore events we don't care about
 * 2. claim the event id (idempotency) — a repeat delivery does nothing
 * 3. re-fetch the subscription from Stripe so out-of-order events cannot regress state
 * 4. upsert; if anything fails, release the claim and rethrow so the caller returns 5xx and Stripe retries
 */
export async function handleWebhookEvent(event: WebhookEvent, deps: WebhookDeps): Promise<WebhookResult> {
  if (!isHandledEvent(event.type)) return { status: "ignored" };
  if ((await deps.claimEvent(event.id, event.type)) === "duplicate") return { status: "duplicate" };

  try {
    const subscriptionId = subscriptionIdFromEvent(event);
    if (!subscriptionId) return { status: "noop" };
    const sub = await deps.retrieveSubscription(subscriptionId);
    const { workspace_id: metaWorkspace, ...row } = toSubscriptionRow(sub, deps.prices);
    const workspaceId = metaWorkspace ?? (await deps.workspaceByCustomer(row.stripe_customer_id));
    if (!workspaceId) throw new Error(`No workspace found for subscription ${sub.id}`);
    await deps.upsertSubscription(workspaceId, row);
    return { status: "processed" };
  } catch (err) {
    await deps.releaseEvent(event.id);
    throw err;
  }
}
