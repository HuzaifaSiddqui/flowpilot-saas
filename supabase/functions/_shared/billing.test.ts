import { describe, expect, it } from "vitest";
import { canManageBilling, extractSubscriptionId, grantsPaidAccess, isHandledEvent, isPaidPlan, planFromPriceId, priceForPlan, toSubscriptionRow } from "./billing";

const prices = { pro: "price_pro", team: "price_team" };
const sub = (over: Record<string, unknown> = {}) => ({
  id: "sub_1", status: "active", customer: "cus_1", cancel_at_period_end: false, metadata: { workspace_id: "ws-1" },
  items: { data: [{ price: { id: "price_pro" }, current_period_end: 1_800_000_000 }] }, ...over,
});

describe("billing helpers", () => {
  it("only active and trialing subscriptions grant paid access", () => {
    expect(grantsPaidAccess("active")).toBe(true);
    expect(grantsPaidAccess("trialing")).toBe(true);
    for (const s of ["past_due", "canceled", "unpaid", "incomplete", "incomplete_expired", "paused"]) expect(grantsPaidAccess(s)).toBe(false);
  });
  it("the browser can name a plan but never supplies a price", () => {
    expect(isPaidPlan("pro")).toBe(true);
    expect(isPaidPlan("price_1Hacked")).toBe(false);
    expect(isPaidPlan("free")).toBe(false);
    expect(priceForPlan("team", prices)).toBe("price_team");
    expect(() => priceForPlan("pro", { pro: "", team: "x" })).toThrow(/No Stripe price/);
  });
  it("maps price ids to plans, defaulting unknown prices to free", () => {
    expect(planFromPriceId("price_pro", prices)).toBe("pro");
    expect(planFromPriceId("price_team", prices)).toBe("team");
    expect(planFromPriceId("price_unknown", prices)).toBe("free");
    expect(planFromPriceId(undefined, prices)).toBe("free");
  });
  it("converts a Stripe subscription into our row", () => {
    expect(toSubscriptionRow(sub(), prices)).toEqual({
      workspace_id: "ws-1", plan: "pro", status: "active", stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1",
      current_period_end: new Date(1_800_000_000 * 1000).toISOString(), cancel_at_period_end: false,
    });
    expect(toSubscriptionRow(sub({ customer: { id: "cus_9" }, metadata: null, cancel_at_period_end: true }), prices))
      .toMatchObject({ workspace_id: null, stripe_customer_id: "cus_9", cancel_at_period_end: true });
  });
  it("finds the subscription id on old and new invoice shapes", () => {
    expect(extractSubscriptionId({ subscription: "sub_old" })).toBe("sub_old");
    expect(extractSubscriptionId({ subscription: { id: "sub_obj" } })).toBe("sub_obj");
    expect(extractSubscriptionId({ parent: { subscription_details: { subscription: "sub_new" } } })).toBe("sub_new");
    expect(extractSubscriptionId({})).toBeNull();
  });
  it("handles exactly the lifecycle events we subscribe to", () => {
    for (const t of ["checkout.session.completed", "customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted", "invoice.paid", "invoice.payment_failed"]) expect(isHandledEvent(t)).toBe(true);
    expect(isHandledEvent("charge.refunded")).toBe(false);
  });
  it("billing is owner-only", () => {
    expect(canManageBilling("owner")).toBe(true);
    for (const r of ["admin", "member", null, undefined, ""]) expect(canManageBilling(r)).toBe(false);
  });
});
