// POST { workspaceId } → { url }   (Stripe Customer Portal: change plan, update card, cancel)
import Stripe from "npm:stripe@18";
import { corsHeaders, json } from "../_shared/cors.ts";
import { authenticate, requireBillingOwner, serviceClient } from "../_shared/auth.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const SITE_URL = (Deno.env.get("SITE_URL") ?? "http://localhost:5173").replace(/\/$/, "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const user = await authenticate(req);
  if (!user) return json({ error: "Unauthorized" }, 401);

  let workspaceId: unknown;
  try { ({ workspaceId } = await req.json()); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (typeof workspaceId !== "string" || !UUID.test(workspaceId)) return json({ error: "Invalid request" }, 400);

  const db = serviceClient();
  if (!(await requireBillingOwner(db, user.id, workspaceId))) return json({ error: "Only the workspace owner can manage billing" }, 403);

  const { data: sub } = await db.from("subscriptions").select("stripe_customer_id").eq("workspace_id", workspaceId).maybeSingle();
  if (!sub?.stripe_customer_id) return json({ error: "No billing account yet — subscribe to a plan first." }, 409);

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${SITE_URL}/billing`,
    });
    return json({ url: session.url });
  } catch (err) {
    console.error("billing-portal failed", err);
    return json({ error: "Could not open the billing portal. Please try again." }, 500);
  }
});
