// Stripe → FlowPilot. Deployed with verify_jwt = false: authenticity is proven by the Stripe signature.
// All decision logic lives in ../_shared/webhook.ts (unit-tested); this file only wires it to Stripe + Postgres.
import Stripe from "npm:stripe@18";
import { serviceClient } from "../_shared/auth.ts";
import { handleWebhookEvent, type WebhookDeps, type WebhookEvent } from "../_shared/webhook.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const rawBody = await req.text();             // must be the untouched body — re-serialising breaks the signature
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, WEBHOOK_SECRET, undefined, cryptoProvider);
  } catch (err) {
    console.warn("Invalid Stripe signature", (err as Error).message);
    return new Response("Invalid signature", { status: 400 });
  }

  const db = serviceClient();
  const deps: WebhookDeps = {
    prices: { pro: Deno.env.get("STRIPE_PRICE_PRO") ?? "", team: Deno.env.get("STRIPE_PRICE_TEAM") ?? "" },
    async claimEvent(id, type) {
      const { error } = await db.from("stripe_events").insert({ stripe_event_id: id, event_type: type });
      if (!error) return "claimed";
      if (error.code === "23505") return "duplicate";   // PK violation → already processed
      throw error;
    },
    async releaseEvent(id) { await db.from("stripe_events").delete().eq("stripe_event_id", id); },
    retrieveSubscription: async (id) => (await stripe.subscriptions.retrieve(id)) as never,
    async workspaceByCustomer(customerId) {
      const { data } = await db.from("subscriptions").select("workspace_id").eq("stripe_customer_id", customerId).maybeSingle();
      return data?.workspace_id ?? null;
    },
    async upsertSubscription(workspaceId, row) {
      const { error } = await db.from("subscriptions").upsert({ ...row, workspace_id: workspaceId, updated_at: new Date().toISOString() }, { onConflict: "workspace_id" });
      if (error) throw error;
    },
  };

  try {
    const result = await handleWebhookEvent(event as unknown as WebhookEvent, deps);
    return new Response(JSON.stringify({ received: true, ...result }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error(`Failed processing ${event.type} ${event.id}`, err);
    return new Response("Processing error", { status: 500 });   // Stripe will retry with backoff
  }
});
