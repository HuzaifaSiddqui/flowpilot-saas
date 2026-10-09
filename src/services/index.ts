import { hasSupabase, supabase } from "@/lib/supabase";
import type { Api } from "./api";
import { demoApi } from "./demoApi";
import { createSupabaseApi } from "./supabaseApi";

/** Real backend when Supabase env vars are present; otherwise the seeded in-browser demo. */
export const api: Api = hasSupabase && supabase ? createSupabaseApi(supabase) : demoApi;
export const isDemo = api.mode === "demo";
export type { Api } from "./api";
