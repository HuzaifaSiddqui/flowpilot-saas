import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";

/**
 * Real PostgreSQL (PGlite = Postgres compiled to WASM) running the project's ACTUAL migration files.
 * Supabase's `auth` schema and roles are stubbed minimally so RLS, grants, triggers and RPCs are exercised
 * exactly as written. No Supabase project or network is needed, so this runs in CI on every push.
 */
const AUTH_STUB = `
  create schema if not exists auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.jwt() returns jsonb language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;

  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public to anon, authenticated, service_role;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.jwt(), auth.uid() to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

export interface TestUser { id: string; email: string }
export type Db = PGlite;

export async function createDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(AUTH_STUB);
  const dir = join(process.cwd(), "supabase", "migrations");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, f), "utf8"));
  }
  return db;
}

/** Sign up a user. The on_auth_user_created trigger creates their profile, workspace and Free subscription. */
export async function signUp(db: PGlite, email: string, fullName: string): Promise<TestUser & { workspaceId: string }> {
  const { rows } = await db.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2::jsonb) returning id`, [email, JSON.stringify({ full_name: fullName })]);
  const id = rows[0].id;
  const ws = await db.query<{ workspace_id: string }>(`select workspace_id from public.workspace_members where user_id = $1 and role = 'owner'`, [id]);
  return { id, email, workspaceId: ws.rows[0].workspace_id };
}

/** Run `fn` as an authenticated user (RLS applies) — equivalent to a PostgREST request with that user's JWT. */
export async function asUser<T>(db: PGlite, user: TestUser, fn: () => Promise<T>): Promise<T> {
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ sub: user.id, email: user.email, role: "authenticated" })]);
  await db.exec("set role authenticated");
  try { return await fn(); } finally { await db.exec("reset role"); }
}

/** Run `fn` with the anon key and no session. */
export async function asAnon<T>(db: PGlite, fn: () => Promise<T>): Promise<T> {
  await db.query(`select set_config('request.jwt.claims', '', false)`);
  await db.exec("set role anon");
  try { return await fn(); } finally { await db.exec("reset role"); }
}

/** Run `fn` as the service role (what Edge Functions use). Bypasses RLS by design. */
export async function asService<T>(db: PGlite, fn: () => Promise<T>): Promise<T> {
  await db.exec("set role service_role");
  try { return await fn(); } finally { await db.exec("reset role"); }
}
