-- FlowPilot — 0003 business logic: signup bootstrap, RPCs, plan limits, activity log

-- ── effective plan: only a paid subscription in good standing unlocks paid tiers
-- active / trialing  → paid plan applies
-- anything else (past_due, canceled, unpaid, incomplete…) → falls back to Free limits
create or replace function private.effective_plan(ws uuid) returns public.plan_tier
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select case when s.status in ('active', 'trialing') then s.plan else 'free'::public.plan_tier end
       from public.subscriptions s where s.workspace_id = ws),
    'free'::public.plan_tier);
$$;

-- ── signup bootstrap: profile + personal workspace + free subscription ──
create or replace function private.bootstrap_workspace(p_user uuid, p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare ws uuid;
begin
  insert into public.workspaces (name, owner_id) values (p_name, p_user) returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, p_user, 'owner');
  insert into public.subscriptions (workspace_id, plan, status) values (ws, 'free', 'active');
  return ws;
end $$;

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare display text;
begin
  display := coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1));
  insert into public.profiles (id, full_name) values (new.id, display);
  perform private.bootstrap_workspace(new.id, display || '''s workspace');
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ── RPC: create another workspace ───────────────────────────────────────
create or replace function public.create_workspace(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Not authenticated' using errcode = '28000'; end if;
  if char_length(trim(p_name)) < 2 then raise exception 'Workspace name is too short' using errcode = '22023'; end if;
  return private.bootstrap_workspace((select auth.uid()), trim(p_name));
end $$;

-- ── RPC: invitations (seat limits enforced here, not in the UI) ─────────
create or replace function public.invite_member(p_workspace uuid, p_email text, p_role public.workspace_role)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(trim(p_email));
  v_seats integer; v_used integer; v_id uuid;
begin
  if not private.is_admin(p_workspace) then raise exception 'Only owners and admins can invite' using errcode = '42501'; end if;
  if p_role = 'owner' then raise exception 'Cannot invite an owner' using errcode = '42501'; end if;
  if p_role = 'admin' and not private.is_owner(p_workspace) then
    raise exception 'Only the owner can invite admins' using errcode = '42501';
  end if;

  select pl.max_seats into v_seats from public.plan_limits pl where pl.plan = private.effective_plan(p_workspace);
  select (select count(*) from public.workspace_members where workspace_id = p_workspace)
       + (select count(*) from public.workspace_invitations where workspace_id = p_workspace and expires_at > now())
    into v_used;
  if v_used >= v_seats then raise exception 'PLAN_LIMIT_SEATS' using errcode = 'P0001'; end if;

  insert into public.workspace_invitations (workspace_id, email, role, invited_by)
  values (p_workspace, v_email, p_role, (select auth.uid()))
  on conflict (workspace_id, email) do update set role = excluded.role, expires_at = now() + interval '14 days'
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.accept_invitation(p_invitation uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare inv public.workspace_invitations;
begin
  select * into inv from public.workspace_invitations where id = p_invitation;
  if not found or inv.expires_at < now() then raise exception 'Invitation not found or expired' using errcode = 'P0002'; end if;
  if inv.email <> lower((select auth.jwt() ->> 'email')) then raise exception 'This invitation is for a different email' using errcode = '42501'; end if;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (inv.workspace_id, (select auth.uid()), inv.role) on conflict do nothing;
  delete from public.workspace_invitations where id = p_invitation;
  return inv.workspace_id;
end $$;

create or replace function public.revoke_invitation(p_invitation uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare ws uuid;
begin
  select workspace_id into ws from public.workspace_invitations where id = p_invitation;
  if ws is null or not private.is_admin(ws) then raise exception 'Not allowed' using errcode = '42501'; end if;
  delete from public.workspace_invitations where id = p_invitation;
end $$;

-- ── RPC: role changes / removal (privilege escalation is impossible from the client)
create or replace function public.change_member_role(p_workspace uuid, p_user uuid, p_role public.workspace_role)
returns void language plpgsql security definer set search_path = '' as $$
declare target public.workspace_role;
begin
  if not private.is_owner(p_workspace) then raise exception 'Only the owner can change roles' using errcode = '42501'; end if;
  if p_role = 'owner' then raise exception 'Ownership transfer is not supported' using errcode = '42501'; end if;
  select role into target from public.workspace_members where workspace_id = p_workspace and user_id = p_user;
  if target is null then raise exception 'Member not found' using errcode = 'P0002'; end if;
  if target = 'owner' then raise exception 'Cannot change the owner''s role' using errcode = '42501'; end if;
  update public.workspace_members set role = p_role where workspace_id = p_workspace and user_id = p_user;
end $$;

create or replace function public.remove_member(p_workspace uuid, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare target public.workspace_role;
begin
  select role into target from public.workspace_members where workspace_id = p_workspace and user_id = p_user;
  if target is null then raise exception 'Member not found' using errcode = 'P0002'; end if;
  if target = 'owner' then raise exception 'The owner cannot be removed' using errcode = '42501'; end if;
  -- members may leave on their own; admins may remove members; only the owner removes admins
  if p_user = (select auth.uid()) then null;
  elsif target = 'admin' and not private.is_owner(p_workspace) then raise exception 'Only the owner can remove admins' using errcode = '42501';
  elsif not private.is_admin(p_workspace) then raise exception 'Not allowed' using errcode = '42501';
  end if;
  delete from public.workspace_members where workspace_id = p_workspace and user_id = p_user;
end $$;

-- ── RPC: entitlements derived ONLY from trusted subscription state ──────
create or replace function public.get_entitlements(p_workspace uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_plan public.plan_tier; lim public.plan_limits; v_projects int; v_seats int;
begin
  if not private.is_member(p_workspace) then raise exception 'Not a member' using errcode = '42501'; end if;
  v_plan := private.effective_plan(p_workspace);
  select * into lim from public.plan_limits where plan = v_plan;
  select count(*) into v_projects from public.projects where workspace_id = p_workspace and status <> 'archived';
  select (select count(*) from public.workspace_members where workspace_id = p_workspace)
       + (select count(*) from public.workspace_invitations where workspace_id = p_workspace and expires_at > now()) into v_seats;
  return jsonb_build_object(
    'plan', v_plan, 'maxProjects', lim.max_projects, 'maxSeats', lim.max_seats,
    'projectsUsed', v_projects, 'seatsUsed', v_seats,
    'canCreateProject', lim.max_projects is null or v_projects < lim.max_projects,
    'canInvite', v_seats < lim.max_seats);
end $$;

-- ── trigger: server-side plan limit for projects ────────────────────────
create or replace function private.enforce_project_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_max int; v_count int;
begin
  if new.status = 'archived' then return new; end if;
  -- also fires when un-archiving, so archive/unarchive can't be used to dodge the cap
  if tg_op = 'UPDATE' and old.status <> 'archived' then return new; end if;
  select pl.max_projects into v_max from public.plan_limits pl where pl.plan = private.effective_plan(new.workspace_id);
  if v_max is null then return new; end if;
  select count(*) into v_count from public.projects where workspace_id = new.workspace_id and status <> 'archived';
  if v_count >= v_max then raise exception 'PLAN_LIMIT_PROJECTS' using errcode = 'P0001'; end if;
  return new;
end $$;

create trigger enforce_project_limit_ins before insert on public.projects for each row execute function private.enforce_project_limit();
create trigger enforce_project_limit_upd before update of status on public.projects for each row execute function private.enforce_project_limit();

-- ── trigger: stamp created_by from the JWT (clients can't spoof authorship)
create or replace function private.stamp_author() returns trigger
language plpgsql security definer set search_path = '' as $$
begin new.created_by := (select auth.uid()); return new; end $$;
create trigger stamp_projects before insert on public.projects for each row execute function private.stamp_author();
create trigger stamp_tasks    before insert on public.tasks    for each row execute function private.stamp_author();

-- ── trigger: audit/activity log ─────────────────────────────────────────
create or replace function private.log_activity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_action text; v_name text; n jsonb := to_jsonb(new); o jsonb := to_jsonb(old);
begin
  v_name := coalesce(n ->> 'name', n ->> 'title');
  if tg_op = 'INSERT' then v_action := 'created';
  elsif tg_table_name = 'tasks' and n ->> 'status' is distinct from o ->> 'status' then
    v_action := 'moved to ' || replace(n ->> 'status', '_', ' ');
  elsif tg_table_name = 'projects' and n ->> 'status' = 'archived' and o ->> 'status' <> 'archived' then
    v_action := 'archived';
  else return new; end if;
  insert into public.activity_logs (workspace_id, actor_id, action, entity_type, entity_id, entity_name)
  values (new.workspace_id, (select auth.uid()), v_action, rtrim(tg_table_name, 's'), new.id, v_name);
  return new;
end $$;

create trigger log_projects after insert or update on public.projects for each row execute function private.log_activity();
create trigger log_tasks    after insert or update on public.tasks    for each row execute function private.log_activity();
create trigger log_clients  after insert           on public.clients  for each row execute function private.log_activity();

-- ── RPC exposure: only signed-in users may call public RPCs ─────────────
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.create_workspace(text), public.invite_member(uuid, text, public.workspace_role),
  public.accept_invitation(uuid), public.revoke_invitation(uuid),
  public.change_member_role(uuid, uuid, public.workspace_role), public.remove_member(uuid, uuid),
  public.get_entitlements(uuid)
to authenticated;
