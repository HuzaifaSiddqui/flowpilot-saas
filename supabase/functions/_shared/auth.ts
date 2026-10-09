import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";
import { canManageBilling } from "./billing.ts";

export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}

/** Verifies the caller's JWT with Supabase Auth. Returns null when missing or invalid. */
export async function authenticate(req: Request): Promise<User | null> {
  const header = req.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: header } },
    auth: { persistSession: false },
  });
  const { data, error } = await anon.auth.getUser();
  return error ? null : data.user;
}

/** Billing is owner-only. The role is read server-side; nothing from the request body is trusted. */
export async function requireBillingOwner(db: SupabaseClient, userId: string, workspaceId: string): Promise<boolean> {
  const { data } = await db
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  return canManageBilling(data?.role);
}
