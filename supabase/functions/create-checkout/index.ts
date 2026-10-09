// POST { workspaceId, plan: "pro" | "team" } → { url }
import Stripe from "npm:stripe@18";
import { corsHeaders, json } from "../_shared/cors.ts";
import { authenticate, requireBillingOwner, serviceClient } from "../_shared/auth.ts";
import { isPaidPlan, priceForPlan } from "../_shared/billing.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const SITE_URL = (Deno.env.get("SITE_URL") ?? "http://localhost:5173").replace(/\/$/, "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  let body: { workspaceId?: unknown; plan?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const { workspaceId, plan } = body;
  if (typeof workspaceId !== "string" || !UUID.test(workspaceId) || !isPaidPlan(plan)) {
    return json({ error: "Invalid request" }, 400);
  }

  const db = serviceClient();
  if (!(await requireBillingOwner(db, user.id, workspaceId))) return json({ error: "Only the workspace owner can manage billing" }, 403);

  try {
    // The price is chosen HERE from server config — never taken from the browser.
    const price = priceForPlan(plan, {
      pro: Deno.env.get("STRIPE_PRICE_PRO") ?? "",
      team: Deno.env.get("STRIPE_PRICE_TEAM") ?? "",
    });

    const { data: sub } = await db.from("subscriptions").select("stripe_customer_id").eq("workspace_id", workspaceId).maybeSingle();
    let customer = sub?.stripe_customer_id as string | null | undefined;
    if (!customer) {
      const created = await stripe.customers.create({ email: user.email, metadata: { workspace_id: workspaceId } });
      customer = created.id;
      await db.from("subscriptions").update({ stripe_customer_id: customer }).eq("workspace_id", workspaceId);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      line_items: [{ price, quantity: 1 }],
      client_reference_id: workspaceId,
      metadata: { workspace_id: workspaceId, plan },
      subscription_data: { metadata: { workspace_id: workspaceId } },
      allow_promotion_codes: true,
      success_url: `${SITE_URL}/billing?checkout=success`,
      cancel_url: `${SITE_URL}/billing?checkout=canceled`,
    });
    return json({ url: session.url });
  } catch (err) {
    console.error("create-checkout failed", err);          // diagnostic detail stays in server logs
    return json({ error: "Could not start checkout. Please try again." }, 500);
  }
});
