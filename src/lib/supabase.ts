import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** True when real Supabase credentials are configured. Otherwise the app runs in Demo Mode. */
export const hasSupabase = Boolean(url && anonKey);

// Only the public anon key ever reaches the browser. The service-role key lives in Edge Functions only.
export const supabase: SupabaseClient | null = hasSupabase
  ? createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;
