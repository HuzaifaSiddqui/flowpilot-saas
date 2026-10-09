import { describe, expect, it } from "vitest";
import { handleWebhookEvent, subscriptionIdFromEvent, type WebhookDeps, type WebhookEvent } from "./webhook";

const prices = { pro: "price_pro", team: "price_team" };

/** In-memory fakes standing in for Stripe + Postgres. */
function harness(opts: { subscription?: Record<string, unknown>; failUpsertOnce?: boolean } = {}) {
  const claimed = new Set<string>();
  const upserts: Array<{ workspaceId: string; row: Record<string, unknown> }> = [];
  const released: string[] = [];
  let failures = opts.failUpsertOnce ? 1 : 0;
  let current = {
    id: "sub_1", status: "active", customer: "cus_1", cancel_at_period_end: false, metadata: { workspace_id: "ws-1" },
    items: { data: [{ price: { id: "price_pro" } }] }, ...opts.subscription,
  };
  const deps: WebhookDeps = {
    prices,
    async claimEvent(id) { if (claimed.has(id)) return "duplicate"; claimed.add(id); return "claimed"; },
    async releaseEvent(id) { claimed.delete(id); released.push(id); },
    async retrieveSubscription() { return current as never; },
    async workspaceByCustomer(c) { return c === "cus_known" ? "ws-by-customer" : null; },
    async upsertSubscription(workspaceId, row) { if (failures-- > 0) throw new Error("db down"); upserts.push({ workspaceId, row: row as never }); },
  };
  return { deps, upserts, released, setSubscription: (s: Record<string, unknown>) => { current = { ...current, ...s }; } };
}
const evt = (type: string, id: string, object: Record<string, unknown> = { id: "sub_1" }): WebhookEvent => ({ id, type, data: { object } });

describe("stripe webhook handler", () => {
  it("BILL-02 · a repeated delivery has no duplicate side effects", async () => {
    const h = harness();
    const e = evt("customer.subscription.updated", "evt_1");
    expect((await handleWebhookEvent(e, h.deps)).status).toBe("processed");
    expect((await handleWebhookEvent(e, h.deps)).status).toBe("duplicate");
    expect((await handleWebhookEvent(e, h.deps)).status).toBe("duplicate");
    expect(h.upserts).toHaveLength(1);
  });
  it("activates the plan on checkout.session.completed", async () => {
    const h = harness();
    await handleWebhookEvent(evt("checkout.session.completed", "evt_2", { subscription: "sub_1" }), h.deps);
    expect(h.upserts[0]).toMatchObject({ workspaceId: "ws-1", row: { plan: "pro", status: "active", stripe_subscription_id: "sub_1" } });
  });
  it("BILL-03 · invoice.payment_failed stores the past_due status (access policy then drops to Free)", async () => {
    const h = harness({ subscription: { status: "past_due" } });
    await handleWebhookEvent(evt("invoice.payment_failed", "evt_3", { parent: { subscription_details: { subscription: "sub_1" } } }), h.deps);
    expect(h.upserts[0].row).toMatchObject({ status: "past_due", plan: "pro" });
  });
  it("cancellation syncs the final state", async () => {
    const h = harness({ subscription: { status: "canceled" } });
    await handleWebhookEvent(evt("customer.subscription.deleted", "evt_4"), h.deps);
    expect(h.upserts[0].row.status).toBe("canceled");
  });
  it("out-of-order delivery cannot regress state: both events write the LATEST subscription from Stripe", async () => {
    const h = harness();
    h.setSubscription({ status: "canceled" });          // Stripe's current truth
    await handleWebhookEvent(evt("customer.subscription.deleted", "evt_late"), h.deps);
    await handleWebhookEvent(evt("customer.subscription.created", "evt_early"), h.deps);   // a stale event arriving afterwards
    expect(h.upserts.map((u) => u.row.status)).toEqual(["canceled", "canceled"]);
  });
  it("a processing failure releases the claim so Stripe's retry succeeds", async () => {
    const h = harness({ failUpsertOnce: true });
    const e = evt("invoice.paid", "evt_5", { subscription: "sub_1" });
    await expect(handleWebhookEvent(e, h.deps)).rejects.toThrow("db down");
    expect(h.released).toEqual(["evt_5"]);
    expect((await handleWebhookEvent(e, h.deps)).status).toBe("processed");   // the retry
    expect(h.upserts).toHaveLength(1);
  });
  it("falls back to the Stripe customer id when metadata has no workspace", async () => {
    const h = harness({ subscription: { metadata: {}, customer: "cus_known" } });
    await handleWebhookEvent(evt("customer.subscription.updated", "evt_6"), h.deps);
    expect(h.upserts[0].workspaceId).toBe("ws-by-customer");
  });
  it("fails loudly (and retries) when no workspace can be found", async () => {
    const h = harness({ subscription: { metadata: {}, customer: "cus_stranger" } });
    await expect(handleWebhookEvent(evt("customer.subscription.updated", "evt_7"), h.deps)).rejects.toThrow(/No workspace/);
    expect(h.released).toEqual(["evt_7"]);
  });
  it("ignores unrelated event types without touching the database", async () => {
    const h = harness();
    expect((await handleWebhookEvent(evt("charge.refunded", "evt_8"), h.deps)).status).toBe("ignored");
    expect(h.upserts).toHaveLength(0);
  });
  it("extracts the subscription id from each event shape", () => {
    expect(subscriptionIdFromEvent(evt("checkout.session.completed", "a", { subscription: { id: "sub_x" } }))).toBe("sub_x");
    expect(subscriptionIdFromEvent(evt("customer.subscription.updated", "a", { id: "sub_y" }))).toBe("sub_y");
    expect(subscriptionIdFromEvent(evt("invoice.paid", "a", { subscription: "sub_z" }))).toBe("sub_z");
  });
});
