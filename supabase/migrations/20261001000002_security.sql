-- FlowPilot — 0002 security: helper functions, grants, Row-Level Security
-- Principle: deny by default. Every table has RLS enabled; clients get only the
-- privileges they need, and billing tables are not writable from the browser at all.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- SECURITY DEFINER helpers avoid recursive RLS on workspace_members and keep
-- policies short. (select auth.uid()) is wrapped so Postgres caches it per statement.
create or replace function private.is_member(ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = ws and wm.user_id = (select auth.uid())
  );
$$;

create or replace function private.member_role(ws uuid) returns public.workspace_role
language sql stable security definer set search_path = '' as $$
  select wm.role from public.workspace_members wm
  where wm.workspace_id = ws and wm.user_id = (select auth.uid());
$$;

create or replace function private.is_admin(ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.member_role(ws) in ('owner', 'admin'), false);
$$;

create or replace function private.is_owner(ws uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(private.member_role(ws) = 'owner', false);
$$;

create or replace function private.shares_workspace(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.workspace_members a
    join public.workspace_members b on b.workspace_id = a.workspace_id
    where a.user_id = (select auth.uid()) and b.user_id = other
  );
$$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;

-- ── privileges: start from zero ─────────────────────────────────────────
revoke all on all tables in schema public from anon, authenticated;

grant select, update (full_name, avatar_url)            on public.profiles              to authenticated;
grant select, update (name)                             on public.workspaces            to authenticated;
grant delete                                            on public.workspaces            to authenticated;
grant select                                            on public.workspace_members     to authenticated;  -- writes via RPC only
grant select                                            on public.workspace_invitations to authenticated;  -- writes via RPC only
grant select, insert, update, delete                    on public.clients               to authenticated;
grant select, insert, update, delete                    on public.projects              to authenticated;
grant select, insert, update, delete                    on public.tasks                 to authenticated;
grant select                                            on public.subscriptions         to authenticated;  -- written by Stripe webhook (service role)
grant select                                            on public.plan_limits           to authenticated;
grant select                                            on public.activity_logs         to authenticated;
-- stripe_events: no grants at all (service role only)

-- ── enable RLS everywhere ───────────────────────────────────────────────
alter table public.profiles              enable row level security;
alter table public.workspaces            enable row level security;
alter table public.workspace_members     enable row level security;
alter table public.workspace_invitations enable row level security;
alter table public.clients               enable row level security;
alter table public.projects              enable row level security;
alter table public.tasks                 enable row level security;
alter table public.subscriptions         enable row level security;
alter table public.stripe_events         enable row level security;
alter table public.plan_limits           enable row level security;
alter table public.activity_logs         enable row level security;

-- ── profiles ────────────────────────────────────────────────────────────
create policy "profiles: read self or co-members" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or private.shares_workspace(id));

create policy "profiles: update self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ── workspaces ──────────────────────────────────────────────────────────
create policy "workspaces: members read" on public.workspaces
  for select to authenticated using (private.is_member(id));

create policy "workspaces: admins rename" on public.workspaces
  for update to authenticated
  using (private.is_admin(id)) with check (private.is_admin(id));

create policy "workspaces: owner deletes" on public.workspaces
  for delete to authenticated using (private.is_owner(id));

-- ── workspace_members (read-only from clients; mutate via RPC) ──────────
create policy "members: members read" on public.workspace_members
  for select to authenticated using (private.is_member(workspace_id));

-- ── invitations ─────────────────────────────────────────────────────────
create policy "invitations: admins read, invitee reads own" on public.workspace_invitations
  for select to authenticated
  using (private.is_admin(workspace_id) or email = lower((select auth.jwt() ->> 'email')));

-- ── clients: all members read/create/update, only admins delete ─────────
create policy "clients: members read"   on public.clients for select to authenticated using (private.is_member(workspace_id));
create policy "clients: members create" on public.clients for insert to authenticated with check (private.is_member(workspace_id));
create policy "clients: members update" on public.clients for update to authenticated
  using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));
create policy "clients: admins delete"  on public.clients for delete to authenticated using (private.is_admin(workspace_id));

-- ── projects ────────────────────────────────────────────────────────────
create policy "projects: members read"   on public.projects for select to authenticated using (private.is_member(workspace_id));
create policy "projects: members create" on public.projects for insert to authenticated with check (private.is_member(workspace_id));
create policy "projects: members update" on public.projects for update to authenticated
  using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));
create policy "projects: admins delete"  on public.projects for delete to authenticated using (private.is_admin(workspace_id));

-- ── tasks ───────────────────────────────────────────────────────────────
create policy "tasks: members read"   on public.tasks for select to authenticated using (private.is_member(workspace_id));
create policy "tasks: members create" on public.tasks for insert to authenticated with check (private.is_member(workspace_id));
create policy "tasks: members update" on public.tasks for update to authenticated
  using (private.is_member(workspace_id)) with check (private.is_member(workspace_id));
create policy "tasks: admins or author delete" on public.tasks for delete to authenticated
  using (private.is_admin(workspace_id) or created_by = (select auth.uid()));

-- ── billing & reference data ────────────────────────────────────────────
create policy "subscriptions: members read" on public.subscriptions
  for select to authenticated using (private.is_member(workspace_id));
create policy "plan_limits: read" on public.plan_limits for select to authenticated using (true);
-- stripe_events: RLS on, zero policies → invisible to every client role.

-- ── activity feed ───────────────────────────────────────────────────────
create policy "activity: members read" on public.activity_logs
  for select to authenticated using (private.is_member(workspace_id));
